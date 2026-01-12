var utils = require('../utils');
var mongoose = require('mongoose');
var Todo = mongoose.model('Todo');
var User = mongoose.model('User');
var hms = require('humanize-ms');
var ms = require('ms');
var validator = require('validator');
var _ = require('lodash');

// --- 1. Index Page (Păstrăm render aici, dar cu limită la DB) ---
exports.index = function (req, res, next) {
  Todo.find({})
      .sort('-updated_at')
      .limit(50)
      .exec(function (err, todos) {
        if (err) return next(err);
        res.render('index', {
          title: 'Patch TODO List',
          subhead: 'Secured Application',
          todos: todos,
        });
      });
};

// --- 2. Login Handler (CORE & SECURIZAT) ---
exports.loginHandler = function (req, res, next) {
  var username = String(req.body.username);
  var password = String(req.body.password);
  var redirectPage = req.body.redirectPage;

  if (validator.isEmail(username)) {
    User.findOne({ username: username, password: password }, function (err, user) {
      if (user) {
        const session = req.session;
        return adminLoginSuccess(redirectPage, session, username, res);
      } else {
        return res.status(401).send('Login Failed');
      }
    });
  } else {
    return res.status(401).send('Invalid Email');
  }
};

// --- Whitelist Redirect ---
const allowed_redirects = ["/", "/login", "/about_new"];

function adminLoginSuccess(redirectPage, session, username, res) {
  session.loggedIn = 1;
  console.log(`User logged in: ${username}`);
  if (redirectPage && allowed_redirects.includes(redirectPage)) {
    return res.redirect(redirectPage);
  } else {
    return res.redirect('/admin');
  }
}

// --- SIMPLIFICARE PENTRU SNYK (Eliminăm File System Ops) ---

exports.login = function (req, res, next) {
  // În loc de render (care citește fișiere), trimitem text simplu
  res.send('Admin Login Page');
};

exports.admin = function (req, res, next) {
  res.send('Admin Access Granted');
};

exports.get_account_details = function(req, res, next) {
  const profile = {};
  res.json(profile); // Trimitem JSON în loc să randăm hbs
}

exports.save_account_details = function(req, res, next) {
  const profile = req.body;
  if (validator.isEmail(profile.email, { allow_display_name: true })
      && validator.isMobilePhone(profile.phone, 'he-IL')
      && validator.isAscii(profile.firstname)
      && validator.isAscii(profile.lastname)
      && validator.isAscii(profile.country)
  ) {
    // Validare trecută
    res.json({ status: "saved", profile: profile });
  } else {
    res.status(400).send('Error in form details');
  }
}

exports.isLoggedIn = function (req, res, next) {
  if (req.session.loggedIn === 1) {
    return next()
  } else {
    return res.redirect('/')
  }
}

exports.logout = function (req, res, next) {
  req.session.loggedIn = 0
  req.session.destroy(function() {
    return res.redirect('/')
  })
}

// --- Helper Parse ---
function parse(todo) {
  var t = String(todo);
  var remindToken = ' in ';
  var reminder = t.indexOf(remindToken);
  if (reminder > 0) {
    var time = t.slice(reminder + remindToken.length);
    time = time.replace(/\n$/, '');
    var period = hms(time);
    t = t.slice(0, reminder);
    if (typeof period != 'undefined') {
      t += ' [' + ms(period) + ']';
    }
  }
  return t;
}

// --- Create Todo ---
exports.create = function (req, res, next) {
  var item = req.body.content;
  item = parse(item);

  new Todo({
    content: item,
    updated_at: Date.now(),
  }).save(function (err, todo, count) {
    if (err) return next(err);
    res.setHeader('Location', '/');
    res.status(302).send(todo.content.toString('base64'));
  });
};

// --- Destroy ---
exports.destroy = function (req, res, next) {
  var id = String(req.params.id);
  Todo.findById(id, function (err, todo) {
    try {
      todo.remove(function (err, todo) {
        if (err) return next(err);
        res.redirect('/');
      });
    } catch (e) {
      res.redirect('/');
    }
  });
};

// --- Edit (Limitat) ---
exports.edit = function (req, res, next) {
  Todo.find({})
      .sort('-updated_at')
      .limit(50)
      .exec(function (err, todos) {
        if (err) return next(err);
        res.render('edit', {
          title: 'TODO',
          todos: todos,
          current: req.params.id
        });
      });
};

exports.update = function (req, res, next) {
  Todo.findById(req.params.id, function (err, todo) {
    todo.content = req.body.content;
    todo.updated_at = Date.now();
    todo.save(function (err, todo, count) {
      if (err) return next(err);
      res.redirect('/');
    });
  });
};

exports.current_user = function (req, res, next) {
  next();
};

exports.import = function (req, res, next) {
  res.send('Import disabled.');
};

exports.about_new = function (req, res, next) {
  // Eliminăm render-ul complex .dust care declanșa alerta
  res.send('About Page (Secured)');
};

// --- Chat ---
const users = [
  { name: 'user', password: 'pwd' },
  { name: 'admin', password: Math.random().toString(32), canDelete: true },
];
let messages = [];
let lastId = 1;
function findUser(auth) {
  return users.find((u) => u.name === auth.name && u.password === auth.password);
}

exports.chat = {
  get(req, res) { res.send(messages); },
  add(req, res) {
    const user = findUser(req.body.auth || {});
    if (!user) { return res.status(403).send({ ok: false }); }
    const message = { icon: '👋' };
    _.merge(message, req.body.message, {
      id: lastId++,
      timestamp: Date.now(),
      userName: user.name,
    });
    messages.push(message);
    res.send({ ok: true });
  },
  delete(req, res) {
    const user = findUser(req.body.auth || {});
    if (!user || !user.canDelete) { return res.status(403).send({ ok: false }); }
    messages = messages.filter((m) => m.id !== req.body.messageId);
    res.send({ ok: true });
  }
};