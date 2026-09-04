const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('../src/adapters/persistence/prismaClient');
const { newObjectId } = require('../src/domain/id');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          'http://localhost:5000/api/auth/google/callback',
        scope: ['profile', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id }
          });

          if (user) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                name: profile.displayName,
                email: profile.emails[0].value,
                avatar: profile.photos[0].value
              }
            });
            return done(null, user);
          }

          const existingUser = await prisma.user.findUnique({
            where: { email: profile.emails[0].value }
          });

          if (existingUser) {
            user = await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                googleId: profile.id,
                name: profile.displayName,
                avatar: profile.photos[0].value
              }
            });
            return done(null, user);
          }

          user = await prisma.user.create({
            data: {
              id: newObjectId(),
              googleId: profile.id,
              name: profile.displayName,
              email: profile.emails[0].value,
              avatar: profile.photos[0].value,
              isEmailVerified: true
            }
          });
          return done(null, user);
        } catch (error) {
          console.error('Error en Google OAuth:', error);
          return done(error, null);
        }
      }
    )
  );
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
