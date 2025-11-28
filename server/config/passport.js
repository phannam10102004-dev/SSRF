const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ googleId: profile.id });

        if (existingUser) {
          return done(null, existingUser);
        }

        // Check if user exists with same email
        const existingEmailUser = await User.findOne({
          email: profile.emails[0].value,
        });

        if (existingEmailUser) {
          // Link google account
          existingEmailUser.googleId = profile.id;
          if (!existingEmailUser.avatar) {
            existingEmailUser.avatar = profile.photos[0].value;
          }
          await existingEmailUser.save();
          return done(null, existingEmailUser);
        }

        // Create new user
        const newUser = new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          avatar: profile.photos[0].value,
          password: "google-auth-placeholder-password-" + Date.now(), // Dummy password
          role: "user",
        });

        await newUser.save();
        done(null, newUser);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

module.exports = passport;
