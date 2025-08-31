import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import cookieParser from 'cookie-parser';
import { connectDB } from './lib/db.js';


dotenv.config();
const app = express();
const PORT=process.env.PORT || 5000;


app.use(express.json());
app.use(cookieParser());


app.use('/auth',authRoutes);

app.listen(PORT,()=>{
    console.log("Server is running on http://localhost:"+PORT);
    connectDB();
})