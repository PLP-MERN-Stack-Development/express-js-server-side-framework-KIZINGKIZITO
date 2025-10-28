// server.js - Starter Express server for Week 2 assignment
require('dotenv').config();

// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'your-secret-api-key-123';

// Custom Error Classes
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}


// Middleware setup
app.use(bodyParser.json());

// Custom Middleware: Request Logger
const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
};

// Custom Middleware: Authentication
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== API_KEY) {  // ← Use the environment variable
    return next(new AuthenticationError('Invalid or missing API key'));
  }
  
  next();
};

// Custom Middleware: Validation for product creation/update
const validateProduct = (req, res, next) => {
  const { name, description, price, category, inStock } = req.body;
  
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!name || typeof name !== 'string') {
      return next(new ValidationError('Product name is required and must be a string'));
    }
    
    if (!description || typeof description !== 'string') {
      return next(new ValidationError('Product description is required and must be a string'));
    }
    
    if (price === undefined || typeof price !== 'number' || price < 0) {
      return next(new ValidationError('Product price is required and must be a positive number'));
    }
    
    if (!category || typeof category !== 'string') {
      return next(new ValidationError('Product category is required and must be a string'));
    }
    
    if (inStock !== undefined && typeof inStock !== 'boolean') {
      return next(new ValidationError('inStock must be a boolean value'));
    }
  }
  
  next();
};

// Apply middleware globally
app.use(requestLogger);

// Sample in-memory products database
let products = [
  {
    id: '1',
    name: 'Laptop',
    description: 'High-performance laptop with 16GB RAM',
    price: 1200,
    category: 'electronics',
    inStock: true
  },
  {
    id: '2',
    name: 'Smartphone',
    description: 'Latest model with 128GB storage',
    price: 800,
    category: 'electronics',
    inStock: true
  },
  {
    id: '3',
    name: 'Coffee Maker',
    description: 'Programmable coffee maker with timer',
    price: 50,
    category: 'kitchen',
    inStock: false
  }
];

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Product API! Go to /api/products to see all products.');
});

// TODO: Implement the following routes:
// GET /api/products - Get all products
// GET /api/products/:id - Get a specific product
// POST /api/products - Create a new product
// PUT /api/products/:id - Update a product
// DELETE /api/products/:id - Delete a product

// GET /api/products - Get all products with filtering and pagination
app.get('/api/products', (req, res, next) => {
  try {
    let filteredProducts = [...products];
    
    // Filter by category
    if (req.query.category) {
      filteredProducts = filteredProducts.filter(
        product => product.category.toLowerCase() === req.query.category.toLowerCase()
      );
    }
    
    // Filter by inStock status
    if (req.query.inStock !== undefined) {
      const inStock = req.query.inStock === 'true';
      filteredProducts = filteredProducts.filter(
        product => product.inStock === inStock
      );
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
    
    res.json({
      products: paginatedProducts,
      currentPage: page,
      totalPages: Math.ceil(filteredProducts.length / limit),
      totalProducts: filteredProducts.length,
      hasNext: endIndex < filteredProducts.length,
      hasPrevious: page > 1
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/search - Search products by name
app.get('/api/products/search', (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return next(new ValidationError('Search query parameter "q" is required'));
    }
    
    const searchResults = products.filter(product =>
      product.name.toLowerCase().includes(q.toLowerCase()) ||
      product.description.toLowerCase().includes(q.toLowerCase())
    );
    
    res.json({
      query: q,
      results: searchResults,
      count: searchResults.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/stats - Get product statistics
app.get('/api/products/stats', (req, res, next) => {
  try {
    const stats = {
      totalProducts: products.length,
      inStock: products.filter(p => p.inStock).length,
      outOfStock: products.filter(p => !p.inStock).length,
      categories: {},
      averagePrice: 0
    };
    
    // Calculate category counts
    products.forEach(product => {
      if (!stats.categories[product.category]) {
        stats.categories[product.category] = 0;
      }
      stats.categories[product.category]++;
    });
    
    // Calculate average price
    if (products.length > 0) {
      const totalPrice = products.reduce((sum, product) => sum + product.price, 0);
      stats.averagePrice = totalPrice / products.length;
    }
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id - Get a specific product by ID
app.get('/api/products/:id', (req, res, next) => {
  try {
    const product = products.find(p => p.id === req.params.id);
    
    if (!product) {
      throw new NotFoundError(`Product with ID ${req.params.id} not found`);
    }
    
    res.json(product);
  } catch (error) {
    next(error);
  }
});

// POST /api/products - Create a new product (with authentication and validation)
app.post('/api/products', authenticate, validateProduct, (req, res, next) => {
  try {
    const { name, description, price, category, inStock = true } = req.body;
    
    const newProduct = {
      id: uuidv4(),
      name,
      description,
      price,
      category,
      inStock
    };
    
    products.push(newProduct);
    
    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/products/:id - Update an existing product (with authentication and validation)
app.put('/api/products/:id', authenticate, validateProduct, (req, res, next) => {
  try {
    const productIndex = products.findIndex(p => p.id === req.params.id);
    
    if (productIndex === -1) {
      throw new NotFoundError(`Product with ID ${req.params.id} not found`);
    }
    
    const { name, description, price, category, inStock } = req.body;
    
    // Update product
    products[productIndex] = {
      ...products[productIndex],
      name: name || products[productIndex].name,
      description: description || products[productIndex].description,
      price: price !== undefined ? price : products[productIndex].price,
      category: category || products[productIndex].category,
      inStock: inStock !== undefined ? inStock : products[productIndex].inStock
    };
    
    res.json({
      message: 'Product updated successfully',
      product: products[productIndex]
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/products/:id - Delete a product (with authentication)
app.delete('/api/products/:id', authenticate, (req, res, next) => {
  try {
    const productIndex = products.findIndex(p => p.id === req.params.id);
    
    if (productIndex === -1) {
      throw new NotFoundError(`Product with ID ${req.params.id} not found`);
    }
    
    const deletedProduct = products.splice(productIndex, 1)[0];
    
    res.json({
      message: 'Product deleted successfully',
      product: deletedProduct
    });
  } catch (error) {
    next(error);
  }
});



// TODO: Implement custom middleware for:
// - Request logging
// - Authentication
// - Error handling
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: {
      name: error.name || 'Error',
      message: message,
      statusCode: statusCode,
      timestamp: new Date().toISOString()
    }
  });
});

// 404 Handler for undefined routes
// 404 Handler for all undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    error: {
      name: 'NotFoundError',
      message: `Route ${req.originalUrl} not found`,
      statusCode: 404
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Export the app for testing purposes
module.exports = app; 