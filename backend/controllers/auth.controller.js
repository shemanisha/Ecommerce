import { json } from 'express';
import User from '../models/user.model.js';
import jsonwebtoken from 'jsonwebtoken';
import redis from '../lib/redis.js';


const generateTokens = (user) => {
    const access_token = jsonwebtoken.sign({ id: user._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
    const refresh_token = jsonwebtoken.sign({ id: user._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
    return { access_token, refresh_token };

}

const storeRefreshToken = async (userId, refreshToken) => {
    try {
        await redis.set(`refresh_token:${userId}`, refreshToken, { ex: 7 * 24 * 60 * 60 }); //7 days
    }
    catch (err) {
        console.error("Error storing refresh token in Redis", err);
    }
}

const setCookies = (res, access_token, refresh_token) => {
    res.cookie('access_token', access_token, {
        httpOnly: true, //prevent XSS
        secure: process.env.NODE_ENV === 'production',
        sameSite: "strict", //prevents CSRF atttack, cross site request forgery
        maxAge: 15 * 60 * 1000 //15 minutes
    });
    res.cookie('refresh_token', refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 //7 days
    });
}


export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (user && await user.comparePassword(password)) {
            //Authenticate user
            const { access_token, refresh_token } = generateTokens(user);
            await storeRefreshToken(user._id, refresh_token);
            // Set HttpOnly cookie
            setCookies(res, access_token, refresh_token);
            return res.status(200).json({ _id: user._id, name: user.name, email: user.email });
        }
        else {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
    } catch (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
}
export const register = async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const userExists = await User.findOne({ email: email.toLowerCase() });
        if (userExists) {
            console.log(userExists);
            return res.status(400).json({ message: "User already exists" });
        }
        else {
            const user = await User.create({ name, email, password });

            //Authenticate user
            const { access_token, refresh_token } = await generateTokens(user);
            await storeRefreshToken(user._id, refresh_token);

            // Set HttpOnly cookie
            setCookies(res, access_token, refresh_token);

            return res.status(201).json({ _id: user._id, name: user.name, email: user.email }, { message: "User registered successfully" });
        }
    }
    catch (err) {
        return res.status(500).json({ message: "Server error", error: err.message });
    }
}
export const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refresh_token;
        if (refreshToken) {
            const decoded = jsonwebtoken.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
            console.log(decoded);
            await redis.del(`refresh_token:${decoded.id}`);
            res.clearCookie('access_token');
            res.clearCookie('refresh_token');
            return res.json({ message: "Logged out successfully" });
        }
        else {
            return res.status(400).json({ message: "No refresh token provided" });
        }

    } catch (err) {
        return res.status(500).json({ message: "Server error", error: err.message });
    }
}

// This will be used to issue a new access token using a valid refresh token.
    export const refreshToken = async (req, res) => {
        try {
            const refreshToken = req.cookies.refresh_token; // Get refresh token from cookies
            if (!refreshToken) {
                return res.status(401).json({ message: "No refresh token provided" });
            }
            const decoded = jsonwebtoken.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
            const storedToken = await redis.get(`refresh_token:${decoded.id}`);
            if (storedToken !== refreshToken) {
                return res.status(401).json({ message: "Invalid refresh token" });
            }  
            const access_token = jsonwebtoken.sign({ id: decoded.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
           
            // Optionally, you can also issue a new refresh token here and update it in Redis and cookies.
            res.cookie('access_token', access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: "strict",
                maxAge: 15 * 60 * 1000 //15 minutes
            });
            return res.json({ message: "Access token refreshed" }); 
        } catch (err) {
            return res.status(500).json({ message: "Server error", error: err.message });
        }
    }
