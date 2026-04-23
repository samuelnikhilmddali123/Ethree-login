const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Employee = require('../models/Employee');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function seedAdmin() {
    console.log('Creating default admin user in MongoDB...\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Default admin credentials
        const adminData = {
            emp_no: 'ADMIN001',
            name: 'Admin User',
            email: 'admin@company.com',
            password: 'admin123', // Mongoose middleware will hash this
            role: 'admin'
        };

        // Check if admin already exists
        const existing = await Employee.findOne({
            $or: [{ emp_no: adminData.emp_no }, { email: adminData.email }]
        });

        if (existing) {
            console.log('⚠️  Admin user already exists!');
            console.log(`   Employee ID: ${existing.emp_no}`);
            console.log(`   Email: ${existing.email}`);
            console.log(`   Role: ${existing.role}`);
            return;
        }

        // Create admin
        const admin = new Employee(adminData);
        await admin.save();

        console.log('✅ Default admin user created successfully!\n');
        console.log('📋 Login Credentials:');
        console.log(`   Employee ID: ${adminData.emp_no}`);
        console.log(`   Password: ${adminData.password}`);
        console.log(`   Email: ${adminData.email}`);
        console.log(`   Role: ${adminData.role}`);
        console.log('\n⚠️  IMPORTANT: Change the default password after first login!\n');

    } catch (error) {
        console.error('❌ Error seeding admin:', error.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

seedAdmin();
