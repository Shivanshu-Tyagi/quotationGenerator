require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Connect to Database
connectDB();

// Create images directory if it doesn't exist
const imgDir = path.join(__dirname, 'images');
if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir);
}

// Static files for images
app.use('/images', express.static(path.join(__dirname, 'images')));

// Routes
const customerRoutes = require('./routes/customerRoutes');
const itemRoutes = require('./routes/itemRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/customers', customerRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Quotation System API Running' });
});

app.post('/api/zoho/create-estimate', async (req, res) => {
    try {
      const zohoResponse = await fetch(
        'https://www.zohoapis.com/books/v3/estimates?organization_id=910990837',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Zoho-oauthtoken 1000.18bf27ab6ed4bcca503ef2af32b07079.3ad120e038e8e2200390db5942d51ab4',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(req.body)
        }
      );
  
      const data = await zohoResponse.json();
  
      if (!zohoResponse.ok) {
        return res.status(zohoResponse.status).json(data);
      }
  
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to contact Zoho' });
    }
  });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0" , () => {
  console.log(`Server running on port ${PORT}`);
});