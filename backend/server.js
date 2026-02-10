const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
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
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected Successfully!'))
.catch(err => console.error('MongoDB Connection Error:', err));

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
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// API Routes

// 1. Admin Authentication
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
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
      username: admin.username
    });
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
      .limit(5)
      .populate('productId', 'name');
    
    const revenue = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    
    res.json({
      totalOrders,
      pendingOrders,
      confirmedOrders,
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

// 3. Product Management
app.get('/api/products', authenticateAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', authenticateAdmin, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', authenticateAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      .populate('productId', 'name');
    
    const total = await Order.countDocuments(query);
    
    res.json({
      orders,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/orders/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      { new: true }
    );
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/reviews/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    );
    res.json({ success: true, review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/reviews/:id', authenticateAdmin, async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Slider Management
app.get('/api/sliders', authenticateAdmin, async (req, res) => {
  try {
    const sliders = await Slider.find().sort({ slideNumber: 1 });
    res.json(sliders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sliders/:id', authenticateAdmin, async (req, res) => {
  try {
    const slider = await Slider.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, slider });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Frontend API Routes (Public)
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

// Initialize default data
async function initializeDefaultData() {
  try {
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
          originalPrice: 3200
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
          originalPrice: 2200
        }
      ];
      
      await Slider.insertMany(defaultSliders);
      console.log('Default sliders created');
    }
    
    // Check if products exist
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      // Add default products from your frontend data
      const defaultProducts = [
        {
          name: "রয়েল সিল্ক পাঞ্জাবি",
          description: "উচ্চমানের সিল্ক কাপড়ে তৈরি, হাতে তৈরি এমব্রয়ডারি, ফিটিং ডিজাইন",
          colors: [
            { name: "লাল ও সোনালী", code: "#dc2626", image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" },
            { name: "নীল ও সোনালী", code: "#1e40af", image: "https://images.unsplash.com/photo-1523380744952-b7e00e6e2ffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" }
          ],
          size: "S, M, L, XL, XXL",
          regularPrice: 3200,
          offerPrice: 2499,
          offerPercentage: 22
        }
      ];
      
      await Product.insertMany(defaultProducts);
      console.log('Default products created');
    }
    
    console.log('Database initialization complete');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initializeDefaultData();
});