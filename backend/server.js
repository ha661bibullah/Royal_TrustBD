const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const fileUpload = require('express-fileupload');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL, 
  process.env.ADMIN_URL,
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'username', 'password', 'x-auth-token']
}));

// Preflight requests
app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload middleware
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
  abortOnLimit: true,
  responseOnLimit: 'File size is too large. Maximum size is 5MB.'
}));

// MongoDB Connection with better error handling
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB Connected Successfully!');
    await initializeDefaultData();
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// Database Schemas
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  colors: [{
    name: String,
    code: String,
    image: String
  }],
  size: { type: String, required: true },
  regularPrice: { type: Number, required: true },
  offerPrice: { type: Number, required: true },
  offerPercentage: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
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
  deliveryCharge: { type: Number, default: 0 },
  paymentMethod: { type: String, default: 'cash_on_delivery' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
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
  badgeText: { type: String },
  badgeColor: { type: String },
  price: { type: Number },
  originalPrice: { type: Number },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const websiteSettingsSchema = new mongoose.Schema({
  whatsappNumber: { type: String, default: '01911465879' },
  phoneNumber: { type: String, default: '01911465879' },
  footerText: { type: String, default: 'প্রিমিয়াম পাঞ্জাবির নির্ভরযোগ্য ঠিকানা' },
  deliveryChargeInsideDhaka: { type: Number, default: 60 },
  deliveryChargeOutsideDhaka: { type: Number, default: 160 },
  serviceHours: { type: String, default: 'সকাল ৯টা - রাত ১০টা' },
  email: { type: String, default: '' },
  facebookPage: { type: String, default: '' },
  instagram: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
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

// Admin Authentication Middleware
const authenticateAdmin = async (req, res, next) => {
  const { username, password } = req.headers;
  
  if (!username || !password) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const admin = await Admin.findOne({ username, password });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    admin.lastLogin = new Date();
    await admin.save();
    
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// API Routes

// 1. Admin Authentication
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    try {
      // Check if admin exists in DB, if not create
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
        username: admin.username,
        lastLogin: admin.lastLogin
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error during login' });
    }
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// 2. Dashboard Statistics
app.get('/api/dashboard/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const confirmedOrders = await Order.countDocuments({ status: 'confirmed' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    const totalProducts = await Product.countDocuments();
    const totalReviews = await Review.countDocuments();
    const pendingReviews = await Review.countDocuments({ isApproved: false });
    
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('productId', 'name')
      .lean();
    
    const revenue = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    
    // Format recent orders
    const formattedRecentOrders = recentOrders.map(order => ({
      orderId: order.orderId,
      customerName: order.customerName,
      productName: order.productName,
      totalPrice: order.totalPrice,
      status: order.status,
      createdAt: order.createdAt,
      phone: order.phone
    }));
    
    res.json({
      totalOrders,
      pendingOrders,
      confirmedOrders,
      deliveredOrders,
      totalProducts,
      totalReviews,
      pendingReviews,
      totalRevenue: revenue[0]?.total || 0,
      recentOrders: formattedRecentOrders
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard statistics' });
  }
});

// 3. Product Management
app.get('/api/products', authenticateAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

app.post('/api/products', authenticateAdmin, async (req, res) => {
  try {
    const productData = req.body;
    productData.createdAt = new Date();
    productData.updatedAt = new Date();
    
    const product = new Product(productData);
    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ success: true, product });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// 4. Order Management
app.get('/api/orders', authenticateAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};
    
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('productId', 'name')
      .lean();
    
    const total = await Order.countDocuments(query);
    
    res.json({
      orders,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

app.put('/api/orders/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, notes, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ success: true, order });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// 5. Review Management
app.get('/api/reviews', authenticateAdmin, async (req, res) => {
  try {
    const { approved } = req.query;
    const query = approved !== undefined ? { isApproved: approved === 'true' } : {};
    
    const reviews = await Review.find(query).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

app.put('/api/reviews/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    );
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    res.json({ success: true, review });
  } catch (error) {
    console.error('Approve review error:', error);
    res.status(500).json({ error: 'Failed to approve review' });
  }
});

app.delete('/api/reviews/:id', authenticateAdmin, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// 6. Slider Management
app.get('/api/sliders', authenticateAdmin, async (req, res) => {
  try {
    const sliders = await Slider.find().sort({ slideNumber: 1 });
    res.json(sliders);
  } catch (error) {
    console.error('Get sliders error:', error);
    res.status(500).json({ error: 'Failed to load sliders' });
  }
});

app.put('/api/sliders/:id', authenticateAdmin, async (req, res) => {
  try {
    const slider = await Slider.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!slider) {
      return res.status(404).json({ error: 'Slider not found' });
    }
    
    res.json({ success: true, slider });
  } catch (error) {
    console.error('Update slider error:', error);
    res.status(500).json({ error: 'Failed to update slider' });
  }
});

// 7. Website Settings
app.get('/api/settings', authenticateAdmin, async (req, res) => {
  try {
    let settings = await WebsiteSettings.findOne();
    if (!settings) {
      settings = new WebsiteSettings();
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.put('/api/settings', authenticateAdmin, async (req, res) => {
  try {
    let settings = await WebsiteSettings.findOne();
    if (!settings) {
      settings = new WebsiteSettings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    
    settings.updatedAt = new Date();
    await settings.save();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Frontend API Routes (Public)
app.post('/api/frontend/order', async (req, res) => {
  try {
    const orderData = req.body;
    
    // Validation
    if (!orderData.customerName || !orderData.phone || !orderData.address || 
        !orderData.productId || !orderData.productName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Generate order ID
    orderData.orderId = generateOrderId();
    orderData.createdAt = new Date();
    orderData.updatedAt = new Date();
    
    const order = new Order(orderData);
    await order.save();
    
    res.json({ 
      success: true, 
      message: 'Order placed successfully',
      orderId: order.orderId,
      order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

app.post('/api/frontend/review', async (req, res) => {
  try {
    const reviewData = req.body;
    
    // Validation
    if (!reviewData.name || !reviewData.location || !reviewData.text || !reviewData.rating) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    reviewData.createdAt = new Date();
    reviewData.isApproved = false; // All reviews need admin approval
    
    const review = new Review(reviewData);
    await review.save();
    
    res.json({ 
      success: true, 
      message: 'Review submitted successfully',
      review 
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

app.get('/api/frontend/products', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();
    res.json(products);
  } catch (error) {
    console.error('Get frontend products error:', error);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

app.get('/api/frontend/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({ isApproved: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json(reviews);
  } catch (error) {
    console.error('Get frontend reviews error:', error);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

app.get('/api/frontend/sliders', async (req, res) => {
  try {
    const sliders = await Slider.find({ isActive: true })
      .sort({ slideNumber: 1 })
      .lean();
    res.json(sliders);
  } catch (error) {
    console.error('Get frontend sliders error:', error);
    res.status(500).json({ error: 'Failed to load sliders' });
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
    console.error('Get frontend settings error:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// Initialize default data
async function initializeDefaultData() {
  try {
    // Create admin user if not exists
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const admin = new Admin({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123'
      });
      await admin.save();
      console.log('✅ Default admin user created');
    }
    
    // Check if sliders exist
    const sliderCount = await Slider.countDocuments();
    if (sliderCount === 0) {
      const defaultSliders = [
        {
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
        },
        {
          slideNumber: 2,
          title: "সুমিষ্ট লিনেন",
          subtitle: "পাঞ্জাবি",
          description: "শীতাতপ নিয়ন্ত্রিত সুতি লিনেন, হালকা ও আরামদায়ক, অফিসিয়াল লুক",
          imageUrl: "https://images.unsplash.com/photo-1523380744952-b7e00e6e2ffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80",
          badgeText: "কটন লিনেন",
          badgeColor: "blue",
          price: 1799,
          originalPrice: 2200,
          isActive: true
        },
        {
          slideNumber: 3,
          title: "লক্ষ্মী সিল্ক",
          subtitle: "বিয়ের পাঞ্জাবি",
          description: "বিয়ের জন্য বিশেষ কালেকশন, জরি ও ঝালর দিয়ে সজ্জিত, আড়ম্বরপূর্ণ ডিজাইন",
          imageUrl: "https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80",
          badgeText: "বিয়ের কালেকশন",
          badgeColor: "purple",
          price: 3499,
          originalPrice: 4500,
          isActive: true
        }
      ];
      
      await Slider.insertMany(defaultSliders);
      console.log('✅ Default sliders created');
    }
    
    // Check if products exist
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      const defaultProducts = [
        {
          name: "রয়েল সিল্ক পাঞ্জাবি",
          description: "উচ্চমানের সিল্ক কাপড়ে তৈরি, হাতে তৈরি এমব্রয়ডারি, ফিটিং ডিজাইন, বিশেষ অনুষ্ঠানের জন্য উপযুক্ত। ১০০% বিশুদ্ধ সিল্ক এবং হাতে তৈরি এমব্রয়ডারি দিয়ে সজ্জিত।",
          colors: [
            { 
              name: "লাল ও সোনালী", 
              code: "#dc2626", 
              image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
            },
            { 
              name: "নীল ও সোনালী", 
              code: "#1e40af", 
              image: "https://images.unsplash.com/photo-1523380744952-b7e00e6e2ffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
            },
            { 
              name: "সবুজ ও স্বর্ণালী", 
              code: "#16a34a", 
              image: "https://images.unsplash.com/photo-1544441893-675973e31985?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
            }
          ],
          size: "S, M, L, XL, XXL",
          regularPrice: 3200,
          offerPrice: 2499,
          offerPercentage: 22,
          isActive: true
        },
        {
          name: "কটন লিনেন পাঞ্জাবি",
          description: "শীতাতপ নিয়ন্ত্রিত সুতি লিনেন, হালকা ও আরামদায়ক, অফিসিয়াল লুকের জন্য উপযুক্ত। দৈনন্দিন ব্যবহার এবং অফিস পরার জন্য আদর্শ।",
          colors: [
            { 
              name: "হালকা নীল", 
              code: "#60a5fa", 
              image: "https://images.unsplash.com/photo-1520006403909-838d6b92c22e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
            },
            { 
              name: "ধূসর", 
              code: "#6b7280", 
              image: "https://images.unsplash.com/photo-1558769132-cb1c458e4222?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
            },
            { 
              name: "সাদা", 
              code: "#ffffff", 
              image: "https://images.unsplash.com/photo-1562157873-818bc0726f68?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
            }
          ],
          size: "M, L, XL, XXL",
          regularPrice: 2200,
          offerPrice: 1799,
          offerPercentage: 18,
          isActive: true
        },
        {
          name: "বিয়ের সিল্ক পাঞ্জাবি",
          description: "বিয়ের জন্য বিশেষ কালেকশন, জরি ও ঝালর দিয়ে সজ্জিত, আড়ম্বরপূর্ণ ডিজাইন। সম্পূর্ণ হাতে তৈরি এবং মেহেদি রঙের বিশেষ সংস্করণ।",
          colors: [
            { 
              name: "মেহেদী রঙ", 
              code: "#92400e", 
              image: "https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
            },
            { 
              name: "লাল ও স্বর্ণালী", 
              code: "#b91c1c", 
              image: "https://images.unsplash.com/photo-1519457431-44ccd64a579b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
            }
          ],
          size: "L, XL, XXL",
          regularPrice: 4500,
          offerPrice: 3499,
          offerPercentage: 22,
          isActive: true
        }
      ];
      
      await Product.insertMany(defaultProducts);
      console.log('✅ Default products created');
    }
    
    // Check if website settings exist
    const settingsCount = await WebsiteSettings.countDocuments();
    if (settingsCount === 0) {
      const defaultSettings = new WebsiteSettings({
        whatsappNumber: '01911465879',
        phoneNumber: '01911465879',
        footerText: 'প্রিমিয়াম পাঞ্জাবির নির্ভরযোগ্য ঠিকানা',
        deliveryChargeInsideDhaka: 60,
        deliveryChargeOutsideDhaka: 160,
        serviceHours: 'সকাল ৯টা - রাত ১০টা'
      });
      await defaultSettings.save();
      console.log('✅ Default website settings created');
    }
    
    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// Health check endpoint for Render
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ROYAL TRUST BD Backend API',
    version: '1.0.0',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
  
  res.status(200).json(healthCheck);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to ROYAL TRUST BD API',
    version: '1.0.0',
    endpoints: {
      admin: '/api/admin/login',
      dashboard: '/api/dashboard/stats',
      products: '/api/products',
      orders: '/api/orders',
      reviews: '/api/reviews',
      sliders: '/api/sliders',
      settings: '/api/settings',
      frontend: {
        products: '/api/frontend/products',
        reviews: '/api/frontend/reviews',
        sliders: '/api/frontend/sliders',
        settings: '/api/frontend/settings',
        order: '/api/frontend/order',
        review: '/api/frontend/review'
      },
      health: '/health'
    },
    documentation: 'Contact support for API documentation'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  
  const statusCode = err.status || 500;
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong!' 
    : err.message;
  
  res.status(statusCode).json({
    success: false,
    message: errorMessage,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      error: err.message 
    })
  });
});

// Graceful shutdown
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

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS Origins: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
  console.log(`📊 Admin Panel: ${process.env.ADMIN_URL || 'http://localhost:5000'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});