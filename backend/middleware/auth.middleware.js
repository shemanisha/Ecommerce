import User from '../models/user.model.js';
import jsonwebtoken from 'jsonwebtoken';

export const protectRoute = async (req, res, next) => {
    try {
        // Middleware logic to protect routes
        const access_token = req.cookies.access_token;
        if (!access_token) {
            return res.status(400).json({ message: "No access token provided" });
        }
        console.log(access_token);
        try {
            const decoded = jsonwebtoken.verify(access_token, process.env.ACCESS_TOKEN_SECRET);
            console.log(decoded);

            // Fetch user from database
            const user = await User.findById(decoded.id);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            req.user = user;
            next();
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: "Access token expired" });
            }
            throw err;
        }
    } catch (err) {
        return res.status(401).json({ message: "Unauthorized -Invalid access token" });
    }
}


export const adminRoute = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: "Forbidden - Admins only" });
    }
}