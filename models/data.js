const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DataSchema = new Schema({
    twitterID: {
        type: String,
    },
    number: {
        type: String,
    }
});

const Entry = mongoose.model('entry', DataSchema);
module.exports = Entry;