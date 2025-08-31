import Product from '../models/Product.model.js';
import redis from '../lib/redis.js';
import cloudinary from '../lib/cloudinary.js';



export const getAllProducts = async (req, res) => {
    try {
        // Logic to get all products from the database
        const products = await Product.find();
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}


export const getFeaturedProducts = async (req, res) => {
    try {
        let featuredProducts = await redis.get('featured_products');
        if (featuredProducts) {
            res.status(200).json(JSON.parse(featuredProducts));
        }
        // If not in redis, fetch from database
        // lean gives plain JS objects instead of Mongoose documents
        featuredProducts = await Product.find({ isFeatured: true }).lean();
        if (!featuredProducts) {
            return res.status(404).json({ message: 'No featured products found' });
        }
        await redis.set('featured_products', JSON.stringify(featuredProducts));
        res.json(featuredProducts);

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

export const createProduct = async (req, res) => {
    try {
        const { name, description, price, image, category, isFeatured } = req.body;
        let cloudinaryResult = null;
        if (image) {
            cloudinaryResult = await cloudinary.uploader.upload(image, {
                folder: 'products'
            });
        }
        const newProduct = await Product.create({
            name,
            description,
            price,
            image: cloudinaryResult ? cloudinaryResult.secure_url : null,
            category,
            isFeatured
        });
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

export const deleteProduct = async (req, res) => {
    try {

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        if (product.image) {
            try {
                const publicId = product.image.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`products/${publicId}`);
            }
            catch (err) {
                console.error("Error deleting image from Cloudinary:", err);
            }
        }
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

export const getRecommendProducts = async (req, res) => {
    try {
        let recommendedProducts = await Product.aggregate([{ $sample: { size: 3 } },
        { $project: { _id:1, name: 1, price: 1, image: 1, description:1 } }
        ]);
        res.json(recommendedProducts);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

export const getProductsByCategory = async (req, res) => {
    try {
        const category = req.params;
        const products = await Product.find({ category: category });
        if (!products || products.length === 0) {
            return res.status(404).json({ message: "No products found in this category" });
        }
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}
export const toggleFeaturedProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);  
        if (product) {
            product.isFeatured = !product.isFeatured;
            const updatedProduct=await product.save();
            updateFeaturesProuctsCache();
            return res.json({ message: "Product featured status toggled", product });
        }
        else {
            return res.status(404).json({ message: "Product not found" });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

const updateFeaturesProuctsCache = async () => {
    try {
        const featuredProducts = await Product.find({ isFeatured: true }).lean();
        await redis.set('featured_products', JSON.stringify(featuredProducts));
    } catch (error) {
        console.error("Error updating featured products cache:", error);
    }
}