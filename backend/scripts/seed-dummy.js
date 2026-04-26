const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Employee = require('../models/Employee');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function seedDummyData() {
    console.log('Seeding dummy data into "test" database...\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Admin User
        const adminData = {
            emp_no: 'ADMIN001',
            name: 'System Admin',
            email: 'admin@test.com',
            password: 'admin123',
            role: 'admin'
        };

        // 2. Dummy Employees
        const dummyEmployees = [
            {
                emp_no: 'EMP001',
                name: 'John Doe',
                email: 'john@test.com',
                password: 'password123',
                role: 'employee'
            },
            {
                emp_no: 'EMP002',
                name: 'Jane Smith',
                email: 'jane@test.com',
                password: 'password123',
                role: 'employee'
            },
            {
                emp_no: 'EMP003',
                name: 'Robert Brown',
                email: 'robert@test.com',
                password: 'password123',
                role: 'employee'
            }
        ];

        // Clear existing data in test database (Optional, but good for fresh start)
        await Employee.deleteMany({});
        console.log('🗑️  Cleared existing employees from test database.');

        // Insert Admin
        const admin = new Employee(adminData);
        await admin.save();
        console.log('✅ Admin user created: ADMIN001 / admin123');

        // Insert Employees
        for (const empData of dummyEmployees) {
            const emp = new Employee(empData);
            await emp.save();
            console.log(`✅ Employee created: ${empData.emp_no} / password123`);
        }

        console.log('\n🚀 All dummy data seeded successfully!');

    } catch (error) {
        console.error('❌ Error seeding data:', error.message);
    } finally {
        await mongoose.connection.close();
    }
}

seedDummyData();
