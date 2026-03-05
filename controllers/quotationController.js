const Quotation = require('../models/quotation');
const Customer = require('../models/customer');
const Item = require('../models/items');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

let browserInstance = null;

// Get all quotations
exports.getAllQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find()
      .populate('customerId', 'name email phone address')
      .populate('items.itemId', 'name price description imagePath')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json(quotations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching quotations', error: error.message });
  }
};

// Create new quotation
exports.createQuotation = async (req, res) => {
  const { 
    customerId, 
    customer, 
    contact, 
    date, 
    expiryDate, 
    ourRef, 
    ourContact, 
    salesOffice, 
    paymentTerms, 
    deliveryTerms, 
    items, 
    tax, 
    discount, 
    notes, 
    total, 
    quotationImages,
    termsAndConditions, termsImage 
  } = req.body;

  if (!customerId || !customer || !items || items.length === 0) {
    return res.status(400).json({ 
      message: 'Customer ID, customer name, and items are required' 
    });
  }

  if (!expiryDate) {
    return res.status(400).json({ 
      message: 'Expiry date is required' 
    });
  }

  try {
    const customerExists = await Customer.findById(customerId);
    if (!customerExists) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    for (let item of items) {
      const itemExists = await Item.findById(item.itemId);
      if (!itemExists) {
        return res.status(404).json({ message: `Item ${item.itemId} not found` });
      }
    }

    let termsImagePath = null;
    if (termsImage && termsImage.startsWith('data:image')) {
      const matches = termsImage.match(/^data:image\/(\w+);base64,(.*)$/);
      if (matches) {
        const ext = matches[1];
        const base64 = matches[2];
        const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + ext;
        const imgDir = path.join(__dirname, '../images');
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
        fs.writeFileSync(path.join(imgDir, filename), Buffer.from(base64, 'base64'));
        termsImagePath = `/images/${filename}`;
      }
    }

    const processedItems = items.map((item, itemIndex) => {
      const itemImagePaths = [];

      if (quotationImages && quotationImages[itemIndex] && Array.isArray(quotationImages[itemIndex])) {
        quotationImages[itemIndex].forEach(imageData => {
          if (imageData && imageData.startsWith('data:image')) {
            const matches = imageData.match(/^data:image\/(\w+);base64,(.*)$/);
            if (matches) {
              const ext = matches[1];
              const base64 = matches[2];
              const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + ext;
              const imgDir = path.join(__dirname, '../images');
              
              if (!fs.existsSync(imgDir)) {
                fs.mkdirSync(imgDir, { recursive: true });
              }

              const filepath = path.join(imgDir, filename);
              fs.writeFileSync(filepath, Buffer.from(base64, 'base64'));
              itemImagePaths.push(`/images/${filename}`);
            }
          }
        });
      }

      return {
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        imagePaths: itemImagePaths
      };
    });

    const quotationNumber = `QT-${Date.now()}`;

    const quotation = new Quotation({
      quotationNumber,
      customerId,
      customer,
      contact,
      date: date || new Date(),
      expiryDate: new Date(expiryDate),
      ourRef,
      ourContact,
      salesOffice,
      paymentTerms,
      deliveryTerms,
      items: processedItems,
      tax: parseFloat(tax) || 0,
      discount: parseFloat(discount) || 0,
      notes,
      termsAndConditions: termsAndConditions || '',  
      termsImage: termsImagePath,
      total: parseFloat(total),
      createdBy: req.user.id, 
      status: 'pending' 
    });

    const savedQuotation = await quotation.save();
    
    const populatedQuotation = await Quotation.findById(savedQuotation._id)
      .populate('customerId', 'name email phone address')
      .populate('items.itemId', 'name price description imagePath')
      .populate('createdBy', 'name email');

    res.status(201).json(populatedQuotation);
  } catch (error) {
    console.error('Error creating quotation:', error);
    res.status(500).json({ message: 'Error creating quotation', error: error.message });
  }
};

// Get user's own quotations
exports.getMyQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find({ createdBy: req.user.id })
      .populate('customerId', 'name email phone')
      .populate('items.itemId', 'name price')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(quotations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching your quotations', error: error.message });
  }
};

// Update getQuotation to check permissions
exports.getQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('customerId', 'name email phone address')
      .populate('items.itemId', 'name price description imagePath')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    // Check if user has permission (admin or creator)
    if (req.user.role !== 'admin' && quotation.createdBy._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this quotation' });
    }

    res.status(200).json(quotation);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching quotation', error: error.message });
  }
};


// Generate PDF using Puppeteer - FIXED VERSION
exports.generatePDF = async (req, res) => {
    const { html, filename = 'quotation' } = req.body;
  
    if (!html) {
      return res.status(400).json({ message: 'HTML content is required' });
    }
  
    let browser;
    const getBrowser = async () => {
      if (!browserInstance || !browserInstance.isConnected()) {
        browserInstance = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
      }
      return browserInstance;
    };
  
    try {
      console.time('PDF Generation Time');
      console.log('Starting PDF generation...');
  
      // Launch Puppeteer
      // browser = await puppeteer.launch({
      //   headless: 'new',
      //   args: [
      //     '--no-sandbox',
      //     '--disable-setuid-sandbox',
      //     '--disable-dev-shm-usage'
      //   ]
      // });

      browser = await getBrowser();
  
      console.log('Browser launched');
  
      const page = await browser.newPage();
      console.log('New page created');
  
      // Set content with timeout
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',  
        timeout: 15000
      });
  
      console.log('Content set on page');
  
      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });
  
      console.log('PDF generated, buffer length:', pdfBuffer.length);
      
      // Check if it's a Buffer
      console.log('Is Buffer?', Buffer.isBuffer(pdfBuffer));
      
      // Check the first 5 bytes PROPERLY for PDF header
      const firstBytes = Buffer.from(pdfBuffer).slice(0, 5);
      console.log('First 5 bytes (raw):', firstBytes);
      
      // Convert to string properly
      const header = String.fromCharCode(...firstBytes);
      console.log('PDF header string:', header);
      
      if (header !== '%PDF-') {
        console.error('Invalid PDF header:', header);
        // Try to see what we got
        console.log('First 20 bytes as hex:', Buffer.from(pdfBuffer).slice(0, 20).toString('hex'));
        console.log('First 20 bytes as string:', Buffer.from(pdfBuffer).slice(0, 20).toString('utf8'));
        throw new Error('Generated file does not have valid PDF header');
      }
  
      console.log('✓ Valid PDF generated');
      console.timeEnd('PDF Generation Time');
  
      await page.close();
  
      // Validate PDF buffer
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Generated PDF buffer is empty');
      }
  
      // Set response headers - IMPORTANT: Use proper content type
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Ensure we're sending a Buffer
      if (Buffer.isBuffer(pdfBuffer)) {
        res.send(pdfBuffer);
      } else {
        // Convert to Buffer if needed
        res.send(Buffer.from(pdfBuffer));
      }
  
    } catch (error) {
      console.error('Error generating PDF:', error);
      
      // Close browser if it exists
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
      
      res.status(500).json({ 
        message: 'Error generating PDF', 
        error: error.message,
        details: error.stack 
      });
    }
  };

// Update quotation
exports.updateQuotation = async (req, res) => {
  const { id } = req.params;
  const {
    customerId, customer, contact, date, expiryDate,
    ourRef, ourContact, salesOffice, paymentTerms, deliveryTerms,
    items, tax, discount, notes, total, quotationImages,
    termsAndConditions, termsImage
  } = req.body;


  try {
    const existing = await Quotation.findById(id);
    if (!existing) return res.status(404).json({ message: 'Quotation not found' });
    if (!existing) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    // Check if user has permission (admin or creator)
    if (req.user.role !== 'admin' && existing.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this quotation' });
    }

    // Check if quotation can be updated (pending only for users, admin can update any)
    if (req.user.role !== 'admin' && existing.status !== 'pending') {
      return res.status(400).json({ 
        message: `Cannot update quotation with status: ${existing.status}` 
      });
    }

    // Process new item images (same logic as create)
    const processedItems = items.map((item, itemIndex) => {
      const itemImagePaths = [...(item.imagePaths || [])]; // keep existing paths

      if (quotationImages?.[itemIndex] && Array.isArray(quotationImages[itemIndex])) {
        quotationImages[itemIndex].forEach(imageData => {
          if (imageData?.startsWith('data:image')) {
            const matches = imageData.match(/^data:image\/(\w+);base64,(.*)$/);
            if (matches) {
              const ext = matches[1];
              const base64 = matches[2];
              const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + ext;
              const imgDir = path.join(__dirname, '../images');
              if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
              fs.writeFileSync(path.join(imgDir, filename), Buffer.from(base64, 'base64'));
              itemImagePaths.push(`/images/${filename}`);
            }
          }
        });
      }

      return {
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        description: item.description || '',   
        imagePaths: itemImagePaths
      };
    });

    // Process updated terms image
    let termsImagePath = existing.termsImage; // keep old one by default
    if (termsImage && termsImage.startsWith('data:image')) {
      const matches = termsImage.match(/^data:image\/(\w+);base64,(.*)$/);
      if (matches) {
        const ext = matches[1];
        const base64 = matches[2];
        const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + ext;
        const imgDir = path.join(__dirname, '../images');
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
        fs.writeFileSync(path.join(imgDir, filename), Buffer.from(base64, 'base64'));
        termsImagePath = `/images/${filename}`;
      }
    } else if (termsImage === null) {
      termsImagePath = null; // explicitly cleared by user
    }

    const updated = await Quotation.findByIdAndUpdate(
      id,
      {
        customerId, customer, contact,
        date: date || existing.date,
        expiryDate: new Date(expiryDate),
        ourRef, ourContact, salesOffice, paymentTerms, deliveryTerms,
        items: processedItems,
        tax: parseFloat(tax) || 0,
        discount: parseFloat(discount) || 0,
        notes,
        termsAndConditions: termsAndConditions || '',
        termsImage: termsImagePath,
        total: parseFloat(total)
      },
      { new: true }
    )
      .populate('customerId', 'name email phone address')
      .populate('items.itemId', 'name price description imagePath');

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating quotation:', error);
    res.status(500).json({ message: 'Error updating quotation', error: error.message });
  }
};

// Delete quotation
exports.deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndDelete(req.params.id);

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    // Check if user has permission (admin or creator)
    if (req.user.role !== 'admin' && quotation.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this quotation' });
    }

    // Check if quotation can be deleted
    if (req.user.role !== 'admin' && quotation.status !== 'pending') {
      return res.status(400).json({ 
        message: `Cannot delete quotation with status: ${quotation.status}` 
      });
    }


    if (quotation.items) {
      quotation.items.forEach(item => {
        if (item.imagePaths && Array.isArray(item.imagePaths)) {
          item.imagePaths.forEach(imagePath => {
            const fullImagePath = path.join(__dirname, '../', imagePath);
            if (fs.existsSync(fullImagePath)) {
              try {
                fs.unlinkSync(fullImagePath);
              } catch (err) {
                console.error('Error deleting image:', err);
              }
            }
          });
        }
      });
    }

    res.status(200).json({ message: 'Quotation deleted successfully' });
  } catch (error) {
    console.error('Error deleting quotation:', error);
    res.status(500).json({ message: 'Error deleting quotation', error: error.message });
  }
};