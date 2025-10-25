# UniMart Backend API

UniMart is a university marketplace platform that enables students to buy and sell items within their school community. This repository contains the backend API built with Node.js, Express, and MongoDB.

## Features

- 🔐 User Authentication (JWT)
  - Email/Password registration and login
  - Google OAuth integration
  - Password reset functionality
  
- 👤 User Profiles
  - School-specific registration
  - Vendor/Buyer roles
  - WhatsApp contact integration
  
- 🛍️ Product Management
  - Create, read, update, and delete products
  - School-specific product listings
  - Category-based filtering
  - Image upload support
  
- 📱 Mobile-Friendly API
  - RESTful endpoints
  - JSON responses
  - File upload handling

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Atlas)
- **ORM**: Prisma
- **Authentication**: JWT & Google OAuth
- **File Storage**: Cloudinary
- **Development**: Nodemon, dotenv

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB Atlas account
- Cloudinary account (for image uploads)

### Environment Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd unimart-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="your_mongodb_connection_string"
   JWT_SECRET="your_jwt_secret"
   PORT=5000
   NODE_ENV=development
   
   CLOUDINARY_CLOUD_NAME="your_cloud_name"
   CLOUDINARY_API_KEY="your_api_key"
   CLOUDINARY_API_SECRET="your_api_secret"
   ```

4. Initialize Prisma:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

### Running the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Authentication

\`\`\`
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/google/callback
\`\`\`

### Profile Management

\`\`\`
PUT  /api/auth/complete-profile
GET  /api/auth/profile
\`\`\`

### Products

\`\`\`
POST   /api/products/create          # Create new product (vendor only)
GET    /api/products/my-products     # Get vendor's products
GET    /api/products/:productId      # Get single product
PUT    /api/products/:productId      # Update product (vendor only)
DELETE /api/products/:productId      # Delete product (vendor only)
GET    /api/products/school/:school  # Get products by school
GET    /api/products/category/:category # Get products by category
\`\`\`

## Data Models

### User
- id: String (ObjectId)
- name: String
- email: String (unique)
- password: String (optional for OAuth)
- school: String
- whatsappNumber: String
- isVendor: Boolean
- profileComplete: Boolean
- googleId: String (optional)
- products: Product[]

### Product
- id: String (ObjectId)
- name: String
- description: String
- price: Float
- image: String (URL)
- school: String
- category: String
- vendorId: String (ObjectId)
- isAvailable: Boolean

## Security

- Password hashing using bcrypt
- JWT-based authentication
- CORS enabled
- Environment variables for sensitive data
- Input validation and sanitization

## Error Handling

The API uses a consistent error response format:
```json
{
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.