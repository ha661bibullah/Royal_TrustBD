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
  origin: ['https://superb-caramel-71d6e8.netlify.app', 'https://stupendous-griffin-263069.netlify.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://billaharif661_db_user:2GCmDhaEOQUteXow@iwonttotast0.mza6qgz.mongodb.net/ROYAL_TRUST_BD?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected Successfully!'))
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
  console.log('Trying with simpler connection string...');
  
  // Alternative connection string
  const simpleURI = 'mongodb+srv://billaharif661_db_user:2GCmDhaEOQUteXow@iwonttotast0.mza6qgz.mongodb.net/ROYAL_TRUST_BD';
  mongoose.connect(simpleURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ Connected with simple URI'))
  .catch(err2 => console.error('❌ Second connection attempt failed:', err2));
});

// Database Schemas
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  colors: [{
    name: String,
    code: String,
    image: String, // Can be URL or base64
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

// Image handling utilities
const saveBase64Image = (base64String, folder = 'products') => {
  try {
    // Remove data:image/png;base64, prefix if present
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generate unique filename
    const filename = `${folder}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
    const filepath = path.join(uploadsDir, filename);
    
    // Save file
    fs.writeFileSync(filepath, buffer);
    
    // Return relative URL
    return `/uploads/${filename}`;
  } catch (error) {
    console.error('Error saving base64 image:', error);
    return null;
  }
};

const saveUploadedFile = (file, folder = 'products') => {
  try {
    // Generate unique filename
    const ext = path.extname(file.name);
    const filename = `${folder}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
    const filepath = path.join(uploadsDir, filename);
    
    // Move file to uploads directory
    file.mv(filepath, (err) => {
      if (err) {
        console.error('Error moving file:', err);
        return null;
      }
    });
    
    // Return relative URL
    return `/uploads/${filename}`;
  } catch (error) {
    console.error('Error saving uploaded file:', error);
    return null;
  }
};

// Basic routes for testing
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Royal Trust BD API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'OK',
    database: dbStatus,
    uptime: process.uptime()
  });
});

// Image Upload Endpoint
app.post('/api/upload', async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'No files were uploaded' });
    }
    
    const file = req.files.file;
    const folder = req.body.folder || 'general';
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only images are allowed' });
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Max size is 5MB' });
    }
    
    // Save file
    const fileUrl = saveUploadedFile(file, folder);
    
    if (!fileUrl) {
      return res.status(500).json({ error: 'Failed to save file' });
    }
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      url: fileUrl
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Base64 Image Upload Endpoint
app.post('/api/upload/base64', async (req, res) => {
  try {
    const { base64, folder = 'general' } = req.body;
    
    if (!base64) {
      return res.status(400).json({ error: 'No base64 data provided' });
    }
    
    // Validate base64 string
    if (!base64.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid base64 image data' });
    }
    
    // Save base64 image
    const fileUrl = saveBase64Image(base64, folder);
    
    if (!fileUrl) {
      return res.status(500).json({ error: 'Failed to save image' });
    }
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      url: fileUrl
    });
    
  } catch (error) {
    console.error('Base64 upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    data: {
      products: 'GET /api/products',
      orders: 'POST /api/frontend/order',
      reviews: 'POST /api/frontend/review'
    }
  });
});

// Public API Routes
app.post('/api/frontend/order', async (req, res) => {
  try {
    const orderData = req.body;
    orderData.orderId = generateOrderId();
    
    const order = new Order(orderData);
    await order.save();
    
    res.json({ 
      success: true, 
      message: 'Order placed successfully',
      orderId: order.orderId 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/frontend/review', async (req, res) => {
  try {
    const review = new Review(req.body);
    await review.save();
    
    res.json({ 
      success: true, 
      message: 'Review submitted successfully',
      review 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/frontend/products', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/frontend/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({ isApproved: true })
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/frontend/sliders', async (req, res) => {
  try {
    const sliders = await Slider.find({ isActive: true }).sort({ slideNumber: 1 });
    res.json(sliders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/frontend/settings', async (req, res) => {
  try {
    let settings = await WebsiteSettings.findOne();
    if (!settings) {
      settings = new WebsiteSettings();
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Authentication
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  // For now, use simple hardcoded check
  if (username === (process.env.ADMIN_USERNAME || 'admin') && 
      password === (process.env.ADMIN_PASSWORD || 'admin123')) {
    
    // Check if admin exists in DB
    let admin = await Admin.findOne({ username });
    if (!admin) {
      admin = new Admin({ username, password });
      await admin.save();
    }
    
    admin.lastLogin = new Date();
    await admin.save();
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      username: admin.username
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Dashboard Statistics
app.get('/api/admin/dashboard/stats', async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    
    const deliveredOrders = await Order.find({ status: 'delivered' });
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.totalPrice, 0);
    
    const totalProducts = await Product.countDocuments();
    const totalReviews = await Review.countDocuments();
    const pendingReviews = await Review.countDocuments({ isApproved: false });
    
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    
    res.json({
      totalOrders,
      pendingOrders,
      deliveredOrders: deliveredOrders.length,
      totalRevenue,
      totalProducts,
      totalReviews,
      pendingReviews,
      recentOrders
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Products API
app.get('/api/admin/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/products', async (req, res) => {
  try {
    const productData = req.body;
    
    // Handle color images
    if (productData.colors && Array.isArray(productData.colors)) {
      for (let color of productData.colors) {
        // If image is base64, save it and update URL
        if (color.image && color.image.startsWith('data:image/')) {
          const imageUrl = saveBase64Image(color.image, 'products');
          if (imageUrl) {
            color.image = imageUrl;
            color.isBase64 = true;
          }
        }
      }
    }
    
    const product = new Product(productData);
    await product.save();
    res.json({ success: true, message: 'Product added successfully', product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/products/:id', async (req, res) => {
  try {
    const productData = req.body;
    
    // Handle color images
    if (productData.colors && Array.isArray(productData.colors)) {
      for (let color of productData.colors) {
        // If image is base64, save it and update URL
        if (color.image && color.image.startsWith('data:image/')) {
          const imageUrl = saveBase64Image(color.image, 'products');
          if (imageUrl) {
            color.image = imageUrl;
            color.isBase64 = true;
          }
        }
      }
    }
    
    const product = await Product.findByIdAndUpdate(req.params.id, productData, { new: true });
    res.json({ success: true, message: 'Product updated successfully', product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Orders API
app.get('/api/admin/orders', async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    if (status) {
      query.status = status;
    }
    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/orders/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      { new: true }
    );
    res.json({ success: true, message: 'Order status updated', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Reviews API
app.get('/api/admin/reviews', async (req, res) => {
  try {
    const { approved } = req.query;
    let query = {};
    if (approved !== undefined) {
      query.isApproved = approved === 'true';
    }
    const reviews = await Review.find(query).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/reviews/:id/approve', async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    );
    res.json({ success: true, message: 'Review approved', review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/reviews/:id', async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Sliders API
app.get('/api/admin/sliders', async (req, res) => {
  try {
    const sliders = await Slider.find().sort({ slideNumber: 1 });
    res.json(sliders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/sliders', async (req, res) => {
  try {
    const sliderData = req.body;
    
    // Handle image if it's base64
    if (sliderData.imageUrl && sliderData.imageUrl.startsWith('data:image/')) {
      const imageUrl = saveBase64Image(sliderData.imageUrl, 'sliders');
      if (imageUrl) {
        sliderData.imageUrl = imageUrl;
        sliderData.isBase64 = true;
      }
    }
    
    const slider = new Slider(sliderData);
    await slider.save();
    res.json({ success: true, message: 'Slider added successfully', slider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/sliders/:id', async (req, res) => {
  try {
    const sliderData = req.body;
    
    // Handle image if it's base64
    if (sliderData.imageUrl && sliderData.imageUrl.startsWith('data:image/')) {
      const imageUrl = saveBase64Image(sliderData.imageUrl, 'sliders');
      if (imageUrl) {
        sliderData.imageUrl = imageUrl;
        sliderData.isBase64 = true;
      }
    }
    
    const slider = await Slider.findByIdAndUpdate(
      req.params.id,
      sliderData,
      { new: true }
    );
    res.json({ success: true, message: 'Slider updated', slider });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/settings', async (req, res) => {
  try {
    let settings = await WebsiteSettings.findOne();
    if (!settings) {
      settings = new WebsiteSettings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    settings.updatedAt = new Date();
    await settings.save();
    res.json({ success: true, message: 'Settings updated', settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize database with sample data
async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Check and create default data
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
    
    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
  }
}

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 MongoDB URI: ${process.env.MONGODB_URI ? 'Set' : 'Not set'}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  
  // Initialize database after connection
  setTimeout(initializeDatabase, 2000);
});

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