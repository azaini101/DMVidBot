const router = require('express').Router();
let Poll = require('../models/poll');

router.route('/:pollID').get((req, res) => {
    Poll.findOne({
        "pollID": req.params.pollID
    })
        .then(poll => {
            res.json(poll)
        })
        .catch(err => res.status(400).json(`error: ${err}`));
});

router.route('/').post((req, res, next) => {
    Poll.countDocuments()
        .then(pollCount => {
            let poll = {pollID: pollCount + 1, ...req.body};
            Poll.create(poll)
                .then((message) => {
                    res.json({message: message, id: poll.pollID});
                }).catch(next);
        })
        .catch(err => res.status(400).json(`error: ${err}`));
});

router.route('/').put((req, res, next) => {
    Poll.findOneAndUpdate({pollID: req.body.pollID}, {questions: req.body.questions})
        .then((message) => {
            res.json(message);
        }).catch(next);
});

module.exports = router;