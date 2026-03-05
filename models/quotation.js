const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    description: { type: String, default: '' }, 
    quantity: {
      type: Number,
      required: [true, 'Please provide quantity'],
      min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
      type: Number,
      required: [true, 'Please provide unit price'],
      min: [0, 'Price cannot be negative']
    },
    imagePaths: [{
      type: String,
      default: null
    }]
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: {
      type: String,
      unique: true,
      required: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    customer: {
      type: String,
      required: true
    },
    contact: {
      type: String,
      default: ''
    },
    date: {
      type: Date,
      default: Date.now
    },
    expiryDate: {
      type: Date,
      required: true
    },
    ourRef: {
      type: String,
      default: ''
    },
    ourContact: {
      type: String,
      default: ''
    },
    salesOffice: {
      type: String,
      default: ''
    },
    paymentTerms: {
      type: String,
      default: ''
    },
    deliveryTerms: {
      type: String,
      default: ''
    },
    items: [quotationItemSchema],
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative']
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative']
    },
    notes: {
      type: String,
      default: ''
    },
    
termsAndConditions: {
  type: String,
  default: ''
},
termsImage: {
  type: String,  
  default: null
},
    total: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'draft', 'sent', 'accepted'],
      default: 'pending'  
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    rejectionReason: {
      type: String,
      default: ''
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quotation', quotationSchema);