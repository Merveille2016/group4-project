
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },

    password: {
        type: String,
        required: true
    },

    twoFactorEnabled: {
        type: Boolean,
        default: false
    },

    twoFactorSecret: {
        type: String,
        default: null
    },

    backupCodes: {
        type: [String],
        default: []
    },

    refreshTokenHash: {
        type: String,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
