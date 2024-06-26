import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });
// PACKAGES
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
// import { fileURLToPath } from 'url';
import { expressjwt } from 'express-jwt';
import passport from 'passport';
import session from 'express-session';
import './oauth/passport.js';

const app = express();
app.use(cors());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());
const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const JWT_TOKEN = process.env.JWT_TOKEN;
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// CONNECTING TO MONGO_DB

mongoose
  .connect(
    `mongodb+srv://${username}:${password}@cluster0.06chanb.mongodb.net/ToDoListDB`
  )
  .catch(err => console.log(err));

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Successfully connected to MongoDB');
});

// DEFININGS SCHEMAS and MODELS

// ITEM SCHEMA

const itemsSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true, default: Date.now },
});

// const Item = mongoose.model('Item', itemsSchema);

// LIST SCHEMA

const listSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  body: { type: String, required: false },
  items: [itemsSchema],
  completedItems: [itemsSchema],
});

const List = mongoose.model('List', listSchema);

// USER SCHEMA

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide an email!'],
    unique: false,
  },
  email: {
    type: String,
    required: [true, 'Please provide an email!'],
    unique: [true, 'Email Exists!'],
  },
  password: {
    type: String,
    required: [
      function () {
        return (
          !this.googleId &&
          !this.facebookId &&
          !this.gitHubId &&
          !this.twitterXId
        );
      },
      'Please provide a password!',
    ],
    unique: false,
    default: null,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  facebookId: {
    type: String,
    unique: true,
    sparse: true,
  },
  gitHubId: {
    type: String,
    unique: true,
    sparse: true,
  },
  twitterXId: {
    type: String,
    unique: true,
    sparse: true,
  },
  lists: [listSchema],
  avatar: {
    type: String,
    required: false,
    unique: false,
  },
});

export const User = mongoose.model('User', userSchema);

// MIDDLEWARE

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(express.static(__dirname + '/api'));

const requireAuth = expressjwt({
  secret: process.env.JWT_TOKEN,
  algorithms: ['HS256'],
  userProperty: 'auth',
});

// API ENDPOINTS

// REGISTER USER
app.post('/api/register', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const dailyList = {
      name: 'Daily',
      url: 'https://images.unsplash.com/photo-1506485338023-6ce5f36692df?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      body: 'Daily tasks!',
    };

    const user = new User({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
      lists: [dailyList],
    });

    const result = await user.save();
    console.log(result);

    // Generate JWT token
    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_TOKEN, {
      expiresIn: '24h',
    });

    res.status(201).send({
      message: 'User Created Successfully',
      token,
    });
  } catch (error) {
    res.status(500).send({
      message: 'Error creating user',
      error,
    });
  }
});

//LOGIN USER
app.post('/api/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).send({
        message: 'User with this email was not found!',
      });
    }

    const passwordCheck = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!passwordCheck) {
      console.log('Password mismatch');
      return res.status(400).send({
        message: 'Password incorrect!',
      });
    }

    // Create JWT token if the password matches
    const token = jwt.sign(
      {
        userId: user._id,
        userEmail: user.email,
      },
      JWT_TOKEN,
      { expiresIn: '24h' }
    );

    // Return success response if login is successful
    res.status(200).send({
      message: 'Login Successful',
      email: user.email,
      token,
    });
    console.log('Login successful!');
  } catch (error) {
    // Generic error response for unexpected errors
    res.status(500).send({
      message: 'An error occurred during login',
      error: error.message,
    });
    console.log('Login failed!');
  }
});

// RENDERING THE LIST OF CARDS FROM DB
app.get('/api/todos', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const lists = user.lists || [];
    res.json({
      success: true,
      message: 'Lists retrieved successfully',
      data: lists,
      count: lists.length,
      defaultListName: 'Daily',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error loading lists!' });
  }
});

// CREATING THE CARD AND SAVING IT TO DB
app.post('/api/todos/addCard', requireAuth, async (req, res) => {
  const { listName: name, listImg: url, listBody: body, items } = req.body;

  try {
    const user = await User.findById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const newList = { name, url, body, items };

    user.lists.push(newList);
    await user.save();

    console.log(
      `Card titled "${name}" was successfully added to the "${user.email}" collection of lists!`
    );

    res.status(201).json({
      success: true,
      message: 'List added successfully!',
      data: user.lists,
      defaultListName: name,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Error saving new card!' });
  }
});

// DELETING THE CARD FROM DB
app.post('/api/todos/deleteCard', requireAuth, async function (req, res) {
  const { listId } = req.body;

  try {
    const user = await User.findById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const listIndex = user.lists.findIndex(list => list._id.equals(listId));
    if (listIndex === -1) {
      return res.status(404).json({ message: 'List not found' });
    }

    const extractImageName = url => {
      const parts = url.split('/');
      return parts[parts.length - 1];
    };

    const imageName = extractImageName(user.lists[listIndex].url);

    user.lists.splice(listIndex, 1);
    await user.save();

    console.log(
      `Card was successfully removed from the user's collection of lists!`
    );
    res.json({
      success: true,
      data: user.lists,
      defaultListName: 'Daily',
      message: 'Updated lists retrieved successfully!',
      image: imageName,
    });
  } catch (err) {
    console.log('Card could not be deleted!', err);
    res.status(500).json({ error: 'Card could not be deleted!' });
  }
});

// UPDATING THE CARD INFORMATION
app.put('/api/todos/updateCard', requireAuth, async function (req, res) {
  const { listId, listName, listBody, listImg } = req.body;
  const userId = req.auth.userId;

  if (!listId || !listName || !listBody) {
    return res.status(400).json({ message: 'All fields are required!' });
  }

  try {
    const user = await User.findOne({ _id: userId, 'lists._id': listId });
    if (!user) {
      return res.status(404).json({ message: 'List not found for this user' });
    }

    const result = await User.updateOne(
      {
        _id: userId,
        'lists._id': listId,
      },
      {
        $set: {
          'lists.$.name': listName,
          'lists.$.body': listBody,
          'lists.$.url': listImg,
        },
      }
    );

    if (result.nModified === 0) {
      return res.status(400).json({ message: 'Failed to update list!' });
    }

    const updatedUser = await User.findById(userId);
    const updatedLists = updatedUser.lists;

    console.log(`Successfully updated information for "${listName}"!`);

    res.json({ success: true, data: updatedLists, defaultListName: listName });
  } catch (error) {
    console.error('Error occurred while updating document:', error);
    res.status(500).json({ error: 'Failed to update list!' });
  }
});

// ADDING TODOS (ITEMS) TO THE LIST
app.post('/api/todos/addItems', requireAuth, async (req, res) => {
  const { newItem, list: listName } = req.body;
  const userId = req.auth.userId;

  try {
    const user = await User.findOne({ _id: userId, 'lists.name': listName });
    if (!user) {
      return res.status(404).json({ message: 'List not found for this user' });
    }

    const result = await User.updateOne(
      { _id: userId, 'lists.name': listName },
      { $push: { 'lists.$.items': { name: newItem } } }
    );

    const updatedUser = await User.findById(userId);
    const updatedLists = updatedUser.lists;

    console.log(
      `Successfully added a "${newItem}" on ${listName} task list to active tasks!`
    );

    res.json({ success: true, data: updatedLists, defaultListName: listName });
  } catch (error) {
    console.error('Error occurred while updating document:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// COMPLETING TODOS (ITEMS) FROM THE LIST
app.put('/api/todos/completeItem', requireAuth, async (req, res) => {
  const { listName, itemId } = req.body;
  const userId = req.auth.userId;

  try {
    const user = await User.findOne({ _id: userId, 'lists.name': listName });
    if (!user) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Find the item to move
    const list = user.lists.find(list => list.name === listName);
    const itemIndex = list.items.findIndex(
      item => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const [completedItem] = list.items.splice(itemIndex, 1);
    completedItem.date = new Date();
    list.completedItems.push(completedItem);

    await user.save();

    console.log(
      `Successfully moved a task with ID: ${itemId} from "${listName}" task list to completed tasks!`
    );

    res.json({ success: true, data: user.lists, defaultListName: listName });
  } catch (error) {
    console.error('Error occurred while moving item:', error);
    res.status(500).json({ error: 'Failed to complete task!' });
  }
});

// DELETING THE TASKS FROM THE COMPLETED LIST
app.delete('/api/todos/deleteItem', requireAuth, async (req, res) => {
  const { listName, itemId } = req.body;
  const userId = req.auth.userId;

  try {
    const user = await User.findOne({ _id: userId, 'lists.name': listName });
    if (!user) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Find the list containing the item to delete
    const list = user.lists.find(list => list.name === listName);
    const itemIndex = list.completedItems.findIndex(
      item => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Remove the item from the list
    list.completedItems.splice(itemIndex, 1);

    await user.save();

    console.log(
      `Successfully deleted a task with ID: ${itemId} from completed tasks list!`
    );

    res.json({ success: true, data: user.lists, defaultListName: listName });
  } catch (error) {
    console.error('Error occurred while deleting item:', error);
    res.status(500).json({ error: 'Failed to delete task!' });
  }
});

//GETTING USER INFORMATION FROM THE DB
app.get('/api/account', requireAuth, async (req, res) => {
  const userId = req.auth.userId;

  try {
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    res.json({
      success: true,
      data: user,
      message: 'User data retrieved successfully!',
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// UPDATING THE USER AVATAR
app.put('/api/account/avatar', requireAuth, async (req, res) => {
  const userId = req.auth.userId;
  const { avatar } = req.body;

  if (!avatar && avatar === '') {
    return res.status(400).json({ message: 'Avatar URL is required!' });
  }

  console.log(`Updating avatar for userId: ${userId} with URL: ${avatar}`);

  try {
    const user = await User.findOneAndUpdate(
      { _id: userId },
      { $set: { avatar } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    res.json({
      success: true,
      data: user,
      message: 'Avatar updated successfully!',
    });
  } catch (error) {
    console.error('Error updating avatar:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// OAUTH

// GOOGLE AUTH
app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get(
  '/auth/google/todocards',
  passport.authenticate('google', {
    failureRedirect: '/login',
  }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user._id, email: req.user.email },
      JWT_TOKEN,
      { expiresIn: '24h' }
    );
    res.redirect(`https://to-do-cards.vercel.app/login/success?token=${token}`);
  }
);

// FACEBOOK AUTH
app.get(
  '/auth/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

app.get(
  '/auth/facebook/callback',
  passport.authenticate('facebook', {
    failureRedirect: '/login',
  }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user._id, email: req.user.email },
      JWT_TOKEN,
      { expiresIn: '24h' }
    );
    res.redirect(`https://to-do-cards.vercel.app/login/success?token=${token}`);
  }
);

// TWITTER X AUTH
app.get('/auth/twitter', passport.authenticate('twitter'));

app.get(
  '/auth/twitter/callback',
  passport.authenticate('twitter', {
    failureRedirect: '/login',
  }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user._id, email: req.user.email },
      JWT_TOKEN,
      { expiresIn: '24h' }
    );
    res.redirect(`https://to-do-cards.vercel.app/login/success?token=${token}`);
  }
);

// GITHUB AUTH
app.get(
  '/auth/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

app.get(
  '/auth/github/callback',
  passport.authenticate('github', {
    failureRedirect: '/login',
  }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user._id, email: req.user.email },
      JWT_TOKEN,
      { expiresIn: '24h' }
    );
    res.redirect(`https://to-do-cards.vercel.app/login/success?token=${token}`);
  }
);

app.get('/api/verify-token', (req, res) => {
  const token = req.headers['authorization'].split(' ')[1];
  jwt.verify(token, JWT_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).json({ valid: false });
    }
    res.json({ valid: true, userId: decoded.userId });
  });
});

// START THE SERVER

app.listen(3000, () => {
  console.log('Server started on port 3000');
});

export default app;
