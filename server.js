const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: ['https://superb-caramel-71d6e8.netlify.app', 
           'https://stupendous-griffin-263069.netlify.app', 
           'http://localhost:3000',
           'http://localhost:5500',
           'http://127.0.0.1:5500',
           'http://localhost:8080',
           'http://127.0.0.1:8080',
           'https://royal-trustbd.onrender.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: '/tmp/',
  createParentPath: true
}));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Uploads directory created:', uploadsDir);
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://billaharif661_db_user:2GCmDhaEOQUteXow@iwonttotast0.mza6qgz.mongodb.net/ROYAL_TRUST_BD?retryWrites=true&w=majority';

console.log('🔌 Connecting to MongoDB...');
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully!');
  console.log('📊 Database:', mongoose.connection.name);
  console.log('👤 Connected as:', mongoose.connection.user);
})
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err.message);
  console.log('Trying with simpler connection string...');
  
  const simpleURI = 'mongodb+srv://billaharif661_db_user:2GCmDhaEOQUteXow@iwonttotast0.mza6qgz.mongodb.net/ROYAL_TRUST_BD?retryWrites=true&w=majority&appName=Cluster0';
  
  mongoose.connect(simpleURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000
  })
  .then(() => console.log('✅ Connected with simple URI'))
  .catch(err2 => {
    console.error('❌ Second connection attempt failed:', err2.message);
    console.log('⚠️  Application will continue without database connection');
  });
});

// Database Schemas
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  colors: [{
    name: String,
    code: String,
    image: String,
    isBase64: { type: Boolean, default: false }
  }],
  size: { type: String, required: true },
  regularPrice: { type: Number, required: true },
  offerPrice: { type: Number, required: true },
  offerPercentage: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, required: true },
  color: { type: String, required: true },
  size: { type: String, required: true },
  quantity: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const reviewSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  text: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  isApproved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const sliderSchema = new mongoose.Schema({
  slideNumber: { type: Number, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: { type: String, required: true },
  isBase64: { type: Boolean, default: false },
  badgeText: { type: String },
  badgeColor: { type: String },
  price: { type: Number },
  originalPrice: { type: Number },
  isActive: { type: Boolean, default: true }
});

const websiteSettingsSchema = new mongoose.Schema({
  whatsappNumber: { type: String, default: '01911465879' },
  phoneNumber: { type: String, default: '01911465879' },
  footerText: { type: String, default: 'প্রিমিয়াম পাঞ্জাবির নির্ভরযোগ্য ঠিকানা' },
  deliveryChargeInsideDhaka: { type: Number, default: 60 },
  deliveryChargeOutsideDhaka: { type: Number, default: 160 },
  serviceHours: { type: String, default: 'সকাল ৯টা - রাত ১০টা' },
  updatedAt: { type: Date, default: Date.now }
});

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  lastLogin: { type: Date }
});

// Models
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const Review = mongoose.model('Review', reviewSchema);
const Slider = mongoose.model('Slider', sliderSchema);
const WebsiteSettings = mongoose.model('WebsiteSettings', websiteSettingsSchema);
const Admin = mongoose.model('Admin', adminSchema);

// Generate unique order ID
function generateOrderId() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `RT${timestamp}${random}`;
}

// Improved Image handling utilities
const saveBase64Image = (base64String, folder = 'products') => {
  return new Promise((resolve, reject) => {
    try {
      // Remove data:image/png;base64, prefix if present
      const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Generate unique filename
      const filename = `${folder}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
      const filepath = path.join(uploadsDir, filename);
      
      // Ensure directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Save file
      fs.writeFile(filepath, buffer, (err) => {
        if (err) {
          console.error('Error saving base64 image:', err);
          reject(err);
          return;
        }
        
        // Return relative URL
        resolve(`/uploads/${filename}`);
      });
    } catch (error) {
      console.error('Error in saveBase64Image:', error);
      reject(error);
    }
  });
};

const saveUploadedFile = (file, folder = 'products') => {
  return new Promise((resolve, reject) => {
    try {
      // Generate unique filename
      const ext = path.extname(file.name) || '.png';
      const filename = `${folder}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
      const filepath = path.join(uploadsDir, filename);
      
      // Ensure directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Move file to uploads directory
      file.mv(filepath, (err) => {
        if (err) {
          console.error('Error moving file:', err);
          reject(err);
          return;
        }
        
        // Return relative URL
        resolve(`/uploads/${filename}`);
      });
    } catch (error) {
      console.error('Error in saveUploadedFile:', error);
      reject(error);
    }
  });
};

// Basic routes for testing
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Royal Trust BD API is running',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      frontend: {
        products: '/api/frontend/products',
        order: '/api/frontend/order (POST)',
        review: '/api/frontend/review (POST)',
        sliders: '/api/frontend/sliders',
        settings: '/api/frontend/settings'
      },
      admin: {
        login: '/api/admin/login (POST)',
        dashboard: '/api/admin/dashboard/stats',
        products: '/api/admin/products',
        orders: '/api/admin/orders',
        reviews: '/api/admin/reviews',
        sliders: '/api/admin/sliders',
        settings: '/api/admin/settings'
      },
      upload: {
        file: '/api/upload (POST)',
        base64: '/api/upload/base64 (POST)'
      }
    }
  });
});

app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({ 
    status: 'OK',
    database: statusMap[dbStatus] || 'unknown',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// File Upload Endpoint (Form Data)
app.post('/api/upload', async (req, res) => {
  try {
    console.log('📤 Upload request received');
    
    if (!req.files || Object.keys(req.files).length === 0) {
      console.log('❌ No files in request');
      return res.status(400).json({ 
        success: false,
        error: 'No files were uploaded' 
      });
    }
    
    const file = req.files.file;
    const folder = req.body.folder || 'general';
    
    console.log('📄 File details:', {
      name: file.name,
      size: file.size,
      mimetype: file.mimetype,
      folder: folder
    });
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      console.log('❌ Invalid file type:', file.mimetype);
      return res.status(400).json({ 
        success: false,
        error: 'Invalid file type. Only images (JPEG, PNG, GIF, WEBP) are allowed' 
      });
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      console.log('❌ File too large:', file.size);
      return res.status(400).json({ 
        success: false,
        error: 'File too large. Max size is 10MB' 
      });
    }
    
    // Save file
    const fileUrl = await saveUploadedFile(file, folder);
    
    if (!fileUrl) {
      console.log('❌ Failed to save file');
      return res.status(500).json({ 
        success: false,
        error: 'Failed to save file' 
      });
    }
    
    console.log('✅ File uploaded successfully:', fileUrl);
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      url: fileUrl,
      fullUrl: `${req.protocol}://${req.get('host')}${fileUrl}`
    });
    
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Base64 Image Upload Endpoint
app.post('/api/upload/base64', async (req, res) => {
  try {
    const { base64, folder = 'general' } = req.body;
    
    if (!base64) {
      return res.status(400).json({ 
        success: false,
        error: 'No base64 data provided' 
      });
    }
    
    // Validate base64 string
    if (!base64.startsWith('data:image/')) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid base64 image data' 
      });
    }
    
    // Save base64 image
    const fileUrl = await saveBase64Image(base64, folder);
    
    if (!fileUrl) {
      return res.status(500).json({ 
        success: false,
        error: 'Failed to save image' 
      });
    }
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      url: fileUrl,
      fullUrl: `${req.protocol}://${req.get('host')}${fileUrl}`
    });
    
  } catch (error) {
    console.error('Base64 upload error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    data: {
      products: 'GET /api/frontend/products',
      orders: 'POST /api/frontend/order',
      reviews: 'POST /api/frontend/review',
      upload: 'POST /api/upload'
    }
  });
});

// Public API Routes
app.post('/api/frontend/order', async (req, res) => {
  try {
    console.log('🛒 New order received:', req.body);
    
    const orderData = req.body;
    
    // Generate order ID if not provided
    if (!orderData.orderId) {
      orderData.orderId = generateOrderId();
    }
    
    // Validate required fields
    const requiredFields = ['customerName', 'phone', 'address', 'productName', 'color', 'size', 'quantity', 'totalPrice'];
    for (const field of requiredFields) {
      if (!orderData[field]) {
        return res.status(400).json({ 
          success: false,
          error: `Missing required field: ${field}` 
        });
      }
    }
    
    const order = new Order(orderData);
    await order.save();
    
    console.log('✅ Order saved:', order.orderId);
    
    res.json({ 
      success: true, 
      message: 'Order placed successfully',
      orderId: order.orderId,
      order: {
        id: order._id,
        orderId: order.orderId,
        customerName: order.customerName,
        productName: order.productName,
        totalPrice: order.totalPrice,
        status: order.status
      }
    });
  } catch (error) {
    console.error('❌ Order error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.post('/api/frontend/review', async (req, res) => {
  try {
    const reviewData = req.body;
    
    // Validate required fields
    if (!reviewData.name || !reviewData.text || !reviewData.rating) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields' 
      });
    }
    
    // Validate rating
    if (reviewData.rating < 1 || reviewData.rating > 5) {
      return res.status(400).json({ 
        success: false,
        error: 'Rating must be between 1 and 5' 
      });
    }
    
    const review = new Review(reviewData);
    await review.save();
    
    res.json({ 
      success: true, 
      message: 'Review submitted successfully',
      review: {
        id: review._id,
        name: review.name,
        location: review.location,
        rating: review.rating,
        text: review.text,
        isApproved: review.isApproved
      }
    });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.get('/api/frontend/products', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ createdAt: -1 });
    
    // Process image URLs
    const processedProducts = products.map(product => {
      const processedProduct = product.toObject();
      
      if (processedProduct.colors && processedProduct.colors.length > 0) {
        processedProduct.colors = processedProduct.colors.map(color => {
          if (color.image && !color.image.startsWith('http')) {
            color.image = `${req.protocol}://${req.get('host')}${color.image}`;
          }
          return color;
        });
      }
      
      return processedProduct;
    });
    
    res.json(processedProducts);
  } catch (error) {
    console.error('Products error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.get('/api/frontend/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({ isApproved: true })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json(reviews);
  } catch (error) {
    console.error('Reviews error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.get('/api/frontend/sliders', async (req, res) => {
  try {
    const sliders = await Slider.find({ isActive: true }).sort({ slideNumber: 1 });
    
    // Process image URLs
    const processedSliders = sliders.map(slider => {
      const processedSlider = slider.toObject();
      
      if (processedSlider.imageUrl && !processedSlider.imageUrl.startsWith('http')) {
        processedSlider.imageUrl = `${req.protocol}://${req.get('host')}${processedSlider.imageUrl}`;
      }
      
      return processedSlider;
    });
    
    res.json(processedSliders);
  } catch (error) {
    console.error('Sliders error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.get('/api/frontend/settings', async (req, res) => {
  try {
    let settings = await WebsiteSettings.findOne();
    if (!settings) {
      settings = new WebsiteSettings();
      await settings.save();
    }
    
    const processedSettings = settings.toObject();
    
    res.json(processedSettings);
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Admin Authentication
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Username and password required' 
      });
    }
    
    // For now, use simple hardcoded check
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      
      // Check if admin exists in DB
      let admin = await Admin.findOne({ username });
      if (!admin) {
        admin = new Admin({ 
          username, 
          password: ADMIN_PASSWORD // In production, hash the password
        });
        await admin.save();
      }
      
      admin.lastLogin = new Date();
      await admin.save();
      
      res.json({ 
        success: true, 
        message: 'Login successful',
        username: admin.username,
        lastLogin: admin.lastLogin
      });
    } else {
      res.status(401).json({ 
        success: false,
        error: 'Invalid credentials' 
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Dashboard Statistics
app.get('/api/admin/dashboard/stats', async (req, res) => {
  try {
    const [
      totalOrders,
      pendingOrders,
      deliveredOrders,
      totalProducts,
      totalReviews,
      pendingReviews
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.find({ status: 'delivered' }),
      Product.countDocuments(),
      Review.countDocuments(),
      Review.countDocuments({ isApproved: false })
    ]);
    
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.totalPrice, 0);
    
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('productId', 'name offerPrice')
      .lean();
    
    // Calculate additional stats
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const conversionRate = totalOrders > 0 ? Math.round((deliveredOrders.length / totalOrders) * 100) : 0;
    
    // Get top product (simplified)
    const allProducts = await Product.find().lean();
    const topProduct = allProducts.length > 0 ? allProducts[0].name : 'No products';
    
    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        deliveredOrders: deliveredOrders.length,
        totalRevenue,
        totalProducts,
        totalReviews,
        pendingReviews,
        recentOrders,
        avgOrderValue,
        conversionRate,
        topProduct,
        monthlyRevenue: totalRevenue // Simplified - in production, calculate by month
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Admin Products API
app.get('/api/admin/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    
    // Process image URLs
    const processedProducts = products.map(product => {
      const processedProduct = product.toObject();
      
      if (processedProduct.colors && processedProduct.colors.length > 0) {
        processedProduct.colors = processedProduct.colors.map(color => {
          if (color.image && !color.image.startsWith('http')) {
            color.image = `${req.protocol}://${req.get('host')}${color.image}`;
          }
          return color;
        });
      }
      
      return processedProduct;
    });
    
    res.json({
      success: true,
      data: processedProducts
    });
  } catch (error) {
    console.error('Admin products error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.post('/api/admin/products', async (req, res) => {
  try {
    const productData = req.body;
    
    // Validate required fields
    const requiredFields = ['name', 'description', 'size', 'regularPrice', 'offerPrice'];
    for (const field of requiredFields) {
      if (!productData[field]) {
        return res.status(400).json({ 
          success: false,
          error: `Missing required field: ${field}` 
        });
      }
    }
    
    // Handle color images if provided as base64
    if (productData.colors && Array.isArray(productData.colors)) {
      for (let i = 0; i < productData.colors.length; i++) {
        const color = productData.colors[i];
        
        // If image is base64, save it and update URL
        if (color.image && color.image.startsWith('data:image/')) {
          try {
            const imageUrl = await saveBase64Image(color.image, 'products');
            if (imageUrl) {
              productData.colors[i].image = imageUrl;
              productData.colors[i].isBase64 = true;
            }
          } catch (error) {
            console.error('Error saving color image:', error);
          }
        }
      }
    }
    
    // Calculate offer percentage if not provided
    if (!productData.offerPercentage && productData.regularPrice && productData.offerPrice) {
      const discount = ((productData.regularPrice - productData.offerPrice) / productData.regularPrice) * 100;
      productData.offerPercentage = Math.round(discount);
    }
    
    const product = new Product(productData);
    await product.save();
    
    res.json({ 
      success: true, 
      message: 'Product added successfully',
      data: product
    });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.put('/api/admin/products/:id', async (req, res) => {
  try {
    const productData = req.body;
    const productId = req.params.id;
    
    // Handle color images if provided as base64
    if (productData.colors && Array.isArray(productData.colors)) {
      for (let i = 0; i < productData.colors.length; i++) {
        const color = productData.colors[i];
        
        // If image is base64, save it and update URL
        if (color.image && color.image.startsWith('data:image/')) {
          try {
            const imageUrl = await saveBase64Image(color.image, 'products');
            if (imageUrl) {
              productData.colors[i].image = imageUrl;
              productData.colors[i].isBase64 = true;
            }
          } catch (error) {
            console.error('Error saving color image:', error);
          }
        }
      }
    }
    
    // Calculate offer percentage if not provided
    if (!productData.offerPercentage && productData.regularPrice && productData.offerPrice) {
      const discount = ((productData.regularPrice - productData.offerPrice) / productData.regularPrice) * 100;
      productData.offerPercentage = Math.round(discount);
    }
    
    const product = await Product.findByIdAndUpdate(
      productId,
      productData,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    
    const product = await Product.findByIdAndDelete(productId);
    
    if (!product) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Admin Orders API
app.get('/api/admin/orders', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    let query = {};
    if (status) {
      query.status = status;
    }
    
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('productId', 'name offerPrice colors')
      .lean();
    
    res.json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.put('/api/admin/orders/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const orderId = req.params.id;
    
    if (!status) {
      return res.status(400).json({ 
        success: false,
        error: 'Status is required' 
      });
    }
    
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid status' 
      });
    }
    
    const order = await Order.findByIdAndUpdate(
      orderId,
      { status, notes },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Order status updated',
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Admin Reviews API
app.get('/api/admin/reviews', async (req, res) => {
  try {
    const { approved, limit = 50 } = req.query;
    
    let query = {};
    if (approved !== undefined) {
      query.isApproved = approved === 'true';
    }
    
    const reviews = await Review.find(query).sort({ createdAt: -1 }).limit(parseInt(limit));
    
    res.json({
      success: true,
      data: reviews,
      count: reviews.length
    });
  } catch (error) {
    console.error('Admin reviews error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.put('/api/admin/reviews/:id/approve', async (req, res) => {
  try {
    const reviewId = req.params.id;
    
    const review = await Review.findByIdAndUpdate(
      reviewId,
      { isApproved: true },
      { new: true }
    );
    
    if (!review) {
      return res.status(404).json({ 
        success: false,
        error: 'Review not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Review approved',
      data: review
    });
  } catch (error) {
    console.error('Approve review error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.delete('/api/admin/reviews/:id', async (req, res) => {
  try {
    const reviewId = req.params.id;
    
    const review = await Review.findByIdAndDelete(reviewId);
    
    if (!review) {
      return res.status(404).json({ 
        success: false,
        error: 'Review not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Review deleted'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Admin Sliders API
app.get('/api/admin/sliders', async (req, res) => {
  try {
    const sliders = await Slider.find().sort({ slideNumber: 1 });
    
    // Process image URLs
    const processedSliders = sliders.map(slider => {
      const processedSlider = slider.toObject();
      
      if (processedSlider.imageUrl && !processedSlider.imageUrl.startsWith('http')) {
        processedSlider.imageUrl = `${req.protocol}://${req.get('host')}${processedSlider.imageUrl}`;
      }
      
      return processedSlider;
    });
    
    res.json({
      success: true,
      data: processedSliders
    });
  } catch (error) {
    console.error('Admin sliders error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.post('/api/admin/sliders', async (req, res) => {
  try {
    const sliderData = req.body;
    
    // Validate required fields
    const requiredFields = ['slideNumber', 'title', 'subtitle', 'description', 'imageUrl'];
    for (const field of requiredFields) {
      if (!sliderData[field]) {
        return res.status(400).json({ 
          success: false,
          error: `Missing required field: ${field}` 
        });
      }
    }
    
    // Handle image if it's base64
    if (sliderData.imageUrl && sliderData.imageUrl.startsWith('data:image/')) {
      try {
        const imageUrl = await saveBase64Image(sliderData.imageUrl, 'sliders');
        if (imageUrl) {
          sliderData.imageUrl = imageUrl;
          sliderData.isBase64 = true;
        }
      } catch (error) {
        console.error('Error saving slider image:', error);
      }
    }
    
    const slider = new Slider(sliderData);
    await slider.save();
    
    res.json({ 
      success: true, 
      message: 'Slider added successfully',
      data: slider
    });
  } catch (error) {
    console.error('Add slider error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.put('/api/admin/sliders/:id', async (req, res) => {
  try {
    const sliderData = req.body;
    const sliderId = req.params.id;
    
    // Handle image if it's base64
    if (sliderData.imageUrl && sliderData.imageUrl.startsWith('data:image/')) {
      try {
        const imageUrl = await saveBase64Image(sliderData.imageUrl, 'sliders');
        if (imageUrl) {
          sliderData.imageUrl = imageUrl;
          sliderData.isBase64 = true;
        }
      } catch (error) {
        console.error('Error saving slider image:', error);
      }
    }
    
    const slider = await Slider.findByIdAndUpdate(
      sliderId,
      sliderData,
      { new: true, runValidators: true }
    );
    
    if (!slider) {
      return res.status(404).json({ 
        success: false,
        error: 'Slider not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Slider updated successfully',
      data: slider
    });
  } catch (error) {
    console.error('Update slider error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.delete('/api/admin/sliders/:id', async (req, res) => {
  try {
    const sliderId = req.params.id;
    
    const slider = await Slider.findByIdAndDelete(sliderId);
    
    if (!slider) {
      return res.status(404).json({ 
        success: false,
        error: 'Slider not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Slider deleted successfully'
    });
  } catch (error) {
    console.error('Delete slider error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Admin Settings API
app.get('/api/admin/settings', async (req, res) => {
  try {
    let settings = await WebsiteSettings.findOne();
    if (!settings) {
      settings = new WebsiteSettings();
      await settings.save();
    }
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.put('/api/admin/settings', async (req, res) => {
  try {
    const settingsData = req.body;
    
    let settings = await WebsiteSettings.findOne();
    if (!settings) {
      settings = new WebsiteSettings(settingsData);
    } else {
      Object.assign(settings, settingsData);
    }
    
    settings.updatedAt = new Date();
    await settings.save();
    
    res.json({ 
      success: true, 
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Initialize database with sample data
async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Check and create default admin
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      await Admin.create({
        username: 'admin',
        password: 'admin123',
        lastLogin: new Date()
      });
      console.log('✅ Default admin created');
    }
    
    // Check and create default settings
    const settingsCount = await WebsiteSettings.countDocuments();
    if (settingsCount === 0) {
      await WebsiteSettings.create({
        whatsappNumber: '01911465879',
        phoneNumber: '01911465879',
        footerText: 'প্রিমিয়াম পাঞ্জাবির নির্ভরযোগ্য ঠিকানা',
        deliveryChargeInsideDhaka: 60,
        deliveryChargeOutsideDhaka: 160,
        serviceHours: 'সকাল ৯টা - রাত ১০টা'
      });
      console.log('✅ Default settings created');
    }
    
    // Check and create sample product
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      await Product.create({
        name: "রয়েল সিল্ক পাঞ্জাবি",
        description: "উচ্চমানের সিল্ক কাপড়ে তৈরি, হাতে তৈরি এমব্রয়ডারি, ফিটিং ডিজাইন",
        colors: [{
          name: "লাল ও সোনালী",
          code: "#dc2626",
          image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        }],
        size: "S, M, L, XL, XXL",
        regularPrice: 3200,
        offerPrice: 2499,
        offerPercentage: 22,
        isActive: true
      });
      console.log('✅ Sample product created');
    }
    
    // Check and create sample slider
    const sliderCount = await Slider.countDocuments();
    if (sliderCount === 0) {
      await Slider.create({
        slideNumber: 1,
        title: "রয়েল সিল্ক",
        subtitle: "পাঞ্জাবি",
        description: "হাতে তৈরি এমব্রয়ডারি, উচ্চমানের সিল্ক কাপড়, রাজকীয় অভিজ্ঞতা",
        imageUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80",
        badgeText: "প্রিমিয়াম কালেকশন",
        badgeColor: "red",
        price: 2499,
        originalPrice: 3200,
        isActive: true
      });
      console.log('✅ Sample slider created');
    }
    
    // Check and create sample review
    const reviewCount = await Review.countDocuments();
    if (reviewCount === 0) {
      await Review.create({
        name: "রহিম আহমেদ",
        location: "ঢাকা",
        text: "পণ্যটি খুবই ভালো মানের। ডেলিভারি সময়মতো পেয়েছি।",
        rating: 5,
        isApproved: true
      });
      console.log('✅ Sample review created');
    }
    
    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`
  🚀 Server running on port ${PORT}
  📡 Health check: http://localhost:${PORT}/health
  🔌 MongoDB URI: ${process.env.MONGODB_URI ? 'Set' : 'Not set'}
  📁 Uploads directory: ${uploadsDir}
  🌐 Access URLs:
     - Local: http://localhost:${PORT}
     - Network: http://${getLocalIP()}:${PORT}
  `);
  
  // Initialize database after connection
  setTimeout(initializeDatabase, 3000);
});

// Get local IP address
function getLocalIP() {
  const interfaces = require('os').networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});