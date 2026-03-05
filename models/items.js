const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide item name'],
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Please provide item price'],
      min: [0, 'Price cannot be negative']
    },
    description: {
      type: String,
      trim: true
    },
    imagePath: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Item', itemSchema);