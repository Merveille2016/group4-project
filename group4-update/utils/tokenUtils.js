
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            type: "refresh"
        },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" }
    );
};

const hashToken = (token) => {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    hashToken
};
