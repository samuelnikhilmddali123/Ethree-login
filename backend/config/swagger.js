const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Ethree Login API Documentation',
      version: '1.0.0',
      description: 'API documentation for the Ethree Employee Work Monitoring & Attendance System.',
      contact: {
        name: 'Samuel Nikhil',
        email: 'samuelnikhilmddali123@gmail.com',
      },
    },
    servers: [
      {
        url: 'https://ethree-login.vercel.app/_/backend',
        description: 'Production server',
      },
      {
        url: 'http://localhost:5000',
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs,
};
