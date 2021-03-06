import raccoon from 'raccoon';
import Bluebird from 'bluebird';
import mongoose from 'mongoose';

import Vote from '../models/vote.model';

/**
 * Load vote and append to req.
 */
function load(req, res, next, id) {
  Vote.get(id, req.user._id)
    .then((vote) => {
      req.vote = vote; // eslint-disable-line no-param-reassign
      return next();
    })
    .catch(e => next(e));
}

/**
 * Get vote
 * @returns {Vote}
 */
function get(req, res) {
  return res.json(req.vote);
}

/**
 * Create new vote
 * @property {string} req.body.userId - The user id of vote.
 * @property {string} req.body.postId - The id of the post the vote is associated with.
 * @property {string} req.body.active - Whether or not the vote is in an upvoted or downvoted state.
 * @property {string} req.body.direction - The direction (upvote/downvote) of the vote.
 * @returns {Vote}
 */
function create(req, res, next) {
  const vote = new Vote({
    userId: req.body.userId,
    postId: req.body.postId,
    active: req.body.active,
    direction: req.body.direction
  });

  vote.save()
    .then(savedVote => res.json(savedVote))
    .catch(e => next(e));
}

/**
 * Update existing vote
 * @property {string} req.body.userId - The user id of vote.
 * @property {string} req.body.postId - The id of the post the vote is associated with.
 * @property {string} req.body.active - Whether or not the vote is in an upvoted or downvoted state.
 * @property {string} req.body.direction - The direction (upvote/downvote) of the vote.
 * @returns {Vote}
 */
function update(req, res, next) {
  const vote = req.vote;
  vote.userId = req.body.userId;
  vote.postId = req.body.postId;
  vote.active = req.body.active;
  vote.direction = req.body.direction;
  vote.save()
    .then(savedVote => res.json(savedVote))
    .catch(e => next(e));
}

/**
 * Get vote list.
 * @property {number} req.query.skip - Number of votes to be skipped.
 * @property {number} req.query.limit - Limit number of votes to be returned.
 * @returns {Vote[]}
 */
function list(req, res, next) {
  const { limit = 50, skip = 0 } = req.query;
  Vote.list({ limit, skip }, req.user._id)
    .then(votes => res.json(votes))
    .catch(e => next(e));
}

/**
 * Delete vote.
 * @returns {Vote}
 */
function remove(req, res, next) {
  const vote = req.vote;
  vote.remove()
    .then(deletedVote => res.json(deletedVote))
    .catch(e => next(e));
}

/**
 * Upvote a post.
 */
function upvote(req, res, next) {
  const post = req.post;

  if (!post.score) post.score = 0;

  Vote.findOne({
    postId: post._id,
    userId: req.user._id,
  })
  .then((voteFound) => {
    const vote = voteFound;
    const userIdString = req.user._id.toString();
    const postIdString = post._id.toString();

    if (vote) {
      let incrementValue = 1;

      // We are changing directly from down to up
      if (vote.direction !== 'upvote' && vote.active) {
        incrementValue = 2;
      }

      vote.active = !vote.active;

      if (vote.direction !== 'upvote') {
        vote.direction = 'upvote';
        vote.active = true;
      }

      if (vote.active) {
        post.score += incrementValue;
        raccoon.liked(userIdString, postIdString);
      } else {
        post.score -= incrementValue;
        raccoon.unliked(userIdString, postIdString);
      }

      return Bluebird.all([vote.save(), post.save()]);
    }

    const newvote = new Vote();
    newvote.postId = post._id;
    newvote.userId = req.user._id;
    newvote.direction = 'upvote'; // @TODO: Make constant
    post.score += 1;
    raccoon.liked(userIdString, postIdString);

    return Bluebird.all([newvote.save(), post.save()]);
  })
  .then((vote) => {
    req.vote = vote[0]; // eslint-disable-line no-param-reassign
    return res.json(vote[0]);
  })
  .catch((e) => {
    next(e);
  });
}


/**
 * Downvote a post.
 */
function downvote(req, res, next) {
  const post = req.post;

  if (!post.score) post.score = 0;

  Vote.findOne({
    postId: post._id,
    userId: req.user._id,
  })
  .then((voteFound) => {
    const vote = voteFound;
    if (vote) {
      let incrementValue = 1;

      // We are changing directly from up to down
      if (vote.direction !== 'downvote' && vote.active) {
        incrementValue = 2;
      }

      vote.active = !vote.active;

      if (vote.direction !== 'downvote') {
        vote.direction = 'downvote';
        vote.active = true;
      }

      if (vote.active) {
        post.score -= incrementValue;
        raccoon.disliked(req.user._id.toString(), post._id.toString());
      } else {
        post.score += incrementValue;
        raccoon.undisliked(req.user._id.toString(), post._id.toString());
      }

      return Bluebird.all([vote.save(), post.save()]);
    }

    const newvote = new Vote();
    newvote.postId = post._id;
    newvote.userId = req.user._id;
    newvote.direction = 'downvote'; // @TODO: Make constant
    post.score -= 1;

    raccoon.disliked(req.user._id.toString(), post._id.toString());

    return Bluebird.all([newvote.save(), post.save()]);
  })
  .then((vote) => {
    req.vote = vote[0]; // eslint-disable-line no-param-reassign
    return res.json(vote[0]);
  })
  .catch(e => next(e));
}

export default { load, get, create, update, list, remove, upvote, downvote };
