const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DataSchema = new Schema({
    username: {
        type: String,
        required: true
    },
    number: {
        type: String,
        required: true
    }
});

const Entry = mongoose.model('Entry', DataSchema);
module.exports = Entry;