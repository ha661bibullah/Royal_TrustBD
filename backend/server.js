const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fileUpload = require('express-fileupload');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: [process.env.FRONTEND_URL, process.env.ADMIN_URL, 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Error:', err));

// Database Schemas
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  colors: [{
    name: String,
    code: String,
    image: String
  }],
  size: String,
  regularPrice: Number,
  offerPrice: Number,
  offerPercentage: Number,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  customerName: String,
  phone: String,
  address: String,
  productName: String,
  color: String,
  size: String,
  quantity: Number,
  totalPrice: Number,
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const reviewSchema = new mongoose.Schema({
  name: String,
  location: String,
  text: String,
  rating: { type: Number, min: 1, max: 5 },
  isApproved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const sliderSchema = new mongoose.Schema({
  slideNumber: Number,
  title: String,
  subtitle: String,
  description: String,
  imageUrl: String,
  badgeText: String,
  badgeColor: String,
  price: Number,
  originalPrice: Number,
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
  username: { type: String, unique: true },
  password: String,
  lastLogin: Date
});

// Models
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const Review = mongoose.model('Review', reviewSchema);
const Slider = mongoose.model('Slider', sliderSchema);
const WebsiteSettings = mongoose.model('WebsiteSettings', websiteSettingsSchema);
const Admin = mongoose.model('Admin', adminSchema);

// Generate Order ID
function generateOrderId() {
  return 'RT' + Date.now().toString().slice(-6) + Math.floor(1000 + Math.random() * 9000);
}

// Authentication Middleware
const authAdmin = async (req, res, next) => {
  const { username, password } = req.headers;
  if (!username || !password) return res.status(401).json({ error: 'Auth required' });
  
  try {
    const admin = await Admin.findOne({ username, password });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    next();
  } catch (error) {
    res.status(500).json({ error: 'Auth failed' });
  }
};

// Routes

// Health Check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Royal Trust BD API',
    time: new Date().toISOString() 
  });
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    let admin = await Admin.findOne({ username });
    if (!admin) {
      admin = new Admin({ username, password });
      await admin.save();
    }
    
    admin.lastLogin = new Date();
    await admin.save();
    
    res.json({ success: true, username: admin.username });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Dashboard Stats
app.get('/api/dashboard/stats', authAdmin, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    const totalProducts = await Product.countDocuments();
    const totalReviews = await Review.countDocuments();
    const pendingReviews = await Review.countDocuments({ isApproved: false });
    
    const revenue = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    
    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5);
    
    res.json({
      totalOrders,
      pendingOrders,
      deliveredOrders,
      totalProducts,
      totalReviews,
      pendingReviews,
      totalRevenue: revenue[0]?.total || 0,
      recentOrders
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Products
app.get('/api/products', authAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', authAdmin, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', authAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', authAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Orders
app.get('/api/orders', authAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/orders/:id/status', authAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { status, notes }, { new: true });
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reviews
app.get('/api/reviews', authAdmin, async (req, res) => {
  try {
    const { approved } = req.query;
    const query = approved !== undefined ? { isApproved: approved === 'true' } : {};
    const reviews = await Review.find(query).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/reviews/:id/approve', authAdmin, async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
    res.json({ success: true, review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/reviews/:id', authAdmin, async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sliders
app.get('/api/sliders', authAdmin, async (req, res) => {
  try {
    const sliders = await Slider.find().sort({ slideNumber: 1 });
    res.json(sliders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sliders/:id', authAdmin, async (req, res) => {
  try {
    const slider = await Slider.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, slider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings
app.get('/api/settings', authAdmin, async (req, res) => {
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

app.put('/api/settings', authAdmin, async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

// Public Routes
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
    const reviews = await Review.find({ isApproved: true }).sort({ createdAt: -1 }).limit(10);
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

// Initialize Database
async function initDB() {
  try {
    // Sliders
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
      console.log('✅ Default slider created');
    }
    
    // Products
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
      console.log('✅ Default product created');
    }
    
    // Settings
    const settingsCount = await WebsiteSettings.countDocuments();
    if (settingsCount === 0) {
      await WebsiteSettings.create({});
      console.log('✅ Default settings created');
    }
    
    // Admin
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      await Admin.create({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD
      });
      console.log('✅ Default admin created');
    }
    
    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Database init error:', error);
  }
}

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
  
  // Initialize database
  await initDB();
});