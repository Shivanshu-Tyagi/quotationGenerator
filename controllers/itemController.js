const Item = require('../models/items');
const fs = require('fs');
const path = require('path');

// Get all items
exports.getAllItems = async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching items', error: error.message });
  }
};

// Create new item with image upload
exports.createItem = async (req, res) => {
  const { name, price, description } = req.body;

  // Validation
  if (!name || !price) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({ message: 'Name and price are required' });
  }

  try {
    const imagePath = req.file ? `/images/${req.file.filename}` : null;

    const item = new Item({
      name,
      price: parseFloat(price),
      description,
      imagePath
    });

    const savedItem = await item.save();
    res.status(201).json(savedItem);
  } catch (error) {
    // Delete uploaded file if save fails
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Error creating item', error: error.message });
  }
};

// Get single item
exports.getItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching item', error: error.message });
  }
};

// Update item
exports.updateItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: 'Item not found' });
    }

    // Delete old image if new one is uploaded
    if (req.file && item.imagePath) {
      const oldImagePath = path.join(__dirname, '../', item.imagePath);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    const updateData = {
      name: req.body.name || item.name,
      price: req.body.price ? parseFloat(req.body.price) : item.price,
      description: req.body.description || item.description,
      imagePath: req.file ? `/images/${req.file.filename}` : item.imagePath
    };

    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json(updatedItem);
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Error updating item', error: error.message });
  }
};

// Delete item
exports.deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Delete image if exists
    if (item.imagePath) {
      const imagePath = path.join(__dirname, '../', item.imagePath);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Item.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting item', error: error.message });
  }
};