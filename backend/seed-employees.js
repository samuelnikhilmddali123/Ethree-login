const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Employee = require('./models/Employee');
const connectDB = require('./config/db');

dotenv.config();

const employees = [
    { name: 'sonali', emp_no: 'EMP001', full_name: 'Sonali Kumari' },
    { name: 'karthik', emp_no: 'EMP002', full_name: 'Karthik Raja' },
    { name: 'sravani', emp_no: 'EMP003', full_name: 'Sravani Bhat' },
    { name: 'ravi', emp_no: 'EMP004', full_name: 'Ravi Teja' },
    { name: 'nikhil', emp_no: 'EMP005', full_name: 'Nikhil Kumar' },
    { name: 'saikiran', emp_no: 'EMP006', full_name: 'Sai Kiran' },
    { name: 'kishore', emp_no: 'EMP007', full_name: 'Kishore Kumar' }
];

const seedEmployees = async () => {
    try {
        await connectDB();

        // 1. Wipe and Re-seed for maximum reliability
        console.log('Clearing existing specific employees to ensure fresh hashing...');
        await Employee.deleteMany({ emp_no: { $in: [...employees.map(e => e.emp_no), 'ADMIN001'] } });

        console.log('Seeding employees with "password123"...');
        for (const empData of employees) {
            const email = `${empData.name}@stackvil.com`;
            const employee = new Employee({
                emp_no: empData.emp_no,
                name: empData.name,
                email: email,
                password: 'password123',
                full_name: empData.full_name,
                role: 'employee',
                status: 'active',
                profile_picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(empData.full_name)}&background=random`
            });
            await employee.save();
            console.log(`✅ ${empData.name} (ID: ${empData.emp_no}) seeded.`);
        }

        console.log('Seeding Admin with "stackvil"...');
        const admin = new Employee({
            emp_no: 'ADMIN001',
            name: 'admin',
            email: 'admin@stackvil.com',
            password: 'stackvil',
            full_name: 'Stackvil Admin',
            role: 'admin',
            status: 'active',
            profile_picture: 'https://ui-avatars.com/api/?name=Admin&background=6366f1&color=fff'
        });
        await admin.save();
        console.log('✅ Admin (ID: ADMIN001) seeded.');

        console.log('\n🚀 SEEDING COMPLETE! All passwords hashed.');
        process.exit();
    } catch (error) {
        console.error('❌ Error seeding:', error.message);
        process.exit(1);
    }
};

seedEmployees();
