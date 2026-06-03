const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Route Test
app.get('/api/test', (req, res) => {
    res.json({ message: "السيرفر ديال كوثر وسناء ناضي وخدام!" });
});

// Port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});