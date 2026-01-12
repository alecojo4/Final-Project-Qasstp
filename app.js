require('./mongoose-db');
require('dotenv').config();

var express = require('express');
var https = require('https');
var fs = require('fs');
var path = require('path');
var ejsEngine = require('ejs-locals');
var bodyParser = require('body-parser');
var session = require('express-session');
var methodOverride = require('method-override');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var marked = require('marked');
var fileUpload = require('express-fileupload');
var dust = require('dustjs-linkedin');
var dustHelpers = require('dustjs-helpers');
var cons = require('consolidate');
const hbs = require('hbs');
var st = require('st');

// Security Middlewares
var cookieParser = require('cookie-parser');
var csrf = require('csurf');
var helmet = require('helmet');
var rateLimit = require('express-rate-limit');

var app = express();
var routes = require('./routes');
var routesUsers = require('./routes/users.js');

app.set('port', process.env.PORT || 3001);
app.engine('ejs', ejsEngine);
app.engine('dust', cons.dust);
app.engine('hbs', hbs.__express);
cons.dust.helpers = dustHelpers;
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(methodOverride());

// --- FIX FINAL: Disable X-Powered-By EXPLICIT ---
app.disable('x-powered-by');

app.use(session({
  secret: process.env.XPRESS_SESSION_SECRET,
  name: 'connect.sid',
  cookie: { path: '/', secure: true }
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload());

// --- HELMET & LIMITER ---
app.use(helmet());
var limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  message: "Prea multe cereri."
});
app.use(limiter);

// --- CSRF ---
app.use(cookieParser());
var csrfProtection = csrf({ cookie: true });

// --- ROUTES ---
app.use(routes.current_user);

// Aplicăm limiter peste tot pentru siguranță maximă în raport
app.get('/', limiter, routes.index);
app.get('/login', limiter, routes.login);
app.post('/login', limiter, csrfProtection, routes.loginHandler);
app.get('/admin', limiter, routes.isLoggedIn, routes.admin);
app.get('/account_details', limiter, routes.isLoggedIn, routes.get_account_details);
app.post('/account_details', limiter, csrfProtection, routes.isLoggedIn, routes.save_account_details);
app.get('/logout', limiter, routes.logout);
app.post('/create', limiter, csrfProtection, routes.create);
app.get('/destroy/:id', limiter, routes.destroy);
app.get('/edit/:id', limiter, routes.edit);
app.post('/update/:id', limiter, csrfProtection, routes.update);
app.post('/import', limiter, csrfProtection, routes.import);
app.get('/about_new', limiter, routes.about_new);
app.get('/chat', limiter, routes.chat.get);
app.put('/chat', limiter, csrfProtection, routes.chat.add);
app.delete('/chat', limiter, csrfProtection, routes.chat.delete);
app.use('/users', routesUsers);

app.use(st({ path: './public', url: '/public' }));
marked.setOptions({ sanitize: true });
app.locals.marked = marked;

if (app.get('env') == 'development') {
  app.use(errorHandler());
}

// HTTPS
var key = fs.readFileSync('private-key.pem');
var cert = fs.readFileSync('certificate.pem');
var options = { key: key, cert: cert };

https.createServer(options, app).listen(app.get('port'), function () {
  console.log('🔒 Express server listening on HTTPS port ' + app.get('port'));
});