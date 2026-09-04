const nodemailer = require('nodemailer');
const { getPrimaryFrontendUrl } = require('../config/frontendEnv');

// Configuración del transporter de email
const createTransporter = () => {
  // En modo desarrollo, usar configuración de prueba si no hay credenciales
  if (process.env.NODE_ENV === 'development' && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
    console.log('⚠️ Modo desarrollo: Usando configuración de email de prueba');
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'verysecret'
      },
      // Configuraciones de timeout y reintentos
      connectionTimeout: 30000, // 30 segundos
      greetingTimeout: 30000,  // 30 segundos
      socketTimeout: 30000,    // 30 segundos
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 20000,        // 20 segundos entre reintentos
      rateLimit: 5             // máximo 5 emails por rateDelta
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    // Configuraciones optimizadas para Render
    connectionTimeout: 30000,  // 30 segundos
    greetingTimeout: 15000,    // 15 segundos
    socketTimeout: 30000,      // 30 segundos
    pool: false,               // Deshabilitar pool para evitar problemas
    maxConnections: 1,         // Solo una conexión
    maxMessages: 1,            // Solo un mensaje por conexión
    rateDelta: 10000,          // 10 segundos entre reintentos
    rateLimit: 1,              // máximo 1 email por rateDelta
    // Configuraciones adicionales para Gmail
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3'
    },
    secure: false,              // Usar STARTTLS
    port: 587,                  // Puerto específico
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development'
  });
};

// Plantilla de email para reset de contraseña
const getResetPasswordTemplate = (name, resetUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Restablecer Contraseña - Quantis</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.5;
          color: #374151;
          margin: 0;
          padding: 20px;
          background-color: #f8fafc;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .email-wrapper {
          width: 100%;
          max-width: 480px;
          margin: 0 auto;
        }
        .container {
          background: white;
          padding: 32px;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          border: 1px solid #e2e8f0;
        }
        .header {
          text-align: center;
          margin-bottom: 32px;
        }
        .logo-container {
          width: 64px;
          height: 64px;
          background: #3b82f6;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: white;
        }
        .title {
          color: #1f2937;
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6b7280;
          font-size: 14px;
          margin-bottom: 0;
        }
        .content {
          margin-bottom: 32px;
        }
        .greeting {
          font-size: 16px;
          margin-bottom: 16px;
          color: #374151;
        }
        .description {
          font-size: 15px;
          margin-bottom: 24px;
          color: #4b5563;
          line-height: 1.6;
        }
        .button-container {
          text-align: center;
          margin: 24px 0;
        }
        .button {
          display: inline-block !important;
          background-color: #1e40af !important;
          background: #1e40af !important;
          color: #ffffff !important;
          padding: 16px 32px !important;
          text-decoration: none !important;
          border-radius: 8px !important;
          font-weight: bold !important;
          font-size: 16px !important;
          text-align: center !important;
          border: 2px solid #1e40af !important;
          mso-padding-alt: 0;
          mso-border-alt: none;
        }
        .button:hover {
          background-color: #1d4ed8 !important;
          background: #1d4ed8 !important;
          border-color: #1d4ed8 !important;
        }
        .warning {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin: 24px 0;
        }
        .warning-title {
          font-weight: 600;
          color: #92400e;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .warning-text {
          color: #92400e;
          font-size: 13px;
          margin: 0;
          line-height: 1.5;
        }
        .footer {
          text-align: center;
          color: #6b7280;
          font-size: 13px;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }
        .code-container {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
          text-align: center;
        }
        .code-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 8px;
          font-weight: 500;
        }
        .code {
          font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
          font-size: 12px;
          color: #374151;
          word-break: break-all;
          line-height: 1.4;
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <div class="logo-container">
              <div class="logo">💰</div>
            </div>
            <h1 class="title">Restablecer Contraseña</h1>
            <p class="subtitle">Recupera el acceso a tu cuenta</p>
          </div>
          
          <div class="content">
            <p class="greeting">Hola <strong>${name}</strong>,</p>
            
            <p class="description">Recibimos una solicitud para restablecer la contraseña de tu cuenta en Quantis. Haz clic en el botón de abajo para continuar.</p>
            
            <div class="button-container">
              <a href="${resetUrl}" class="button" style="display: inline-block; background-color: #1e40af; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; text-align: center; border: 2px solid #1e40af;">Restablecer Contraseña</a>
            </div>
            
            <div class="warning">
              <div class="warning-title">⚠️ Información Importante</div>
              <p class="warning-text">Este enlace expirará en <strong>1 hora</strong> por seguridad. Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
            </div>
            
            <div class="code-container">
              <div class="code-label">¿El botón no funciona? Copia y pega este enlace:</div>
              <div class="code">${resetUrl}</div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Plantilla para email de confirmación de cambio de contraseña
const getPasswordChangedTemplate = (name) => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Contraseña Actualizada - Quantis</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #374151;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9fafb;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08);
          border: 1px solid #e5e7eb;
        }
        .header {
          text-align: center;
          margin-bottom: 32px;
        }
        .brand-logo {
          font-size: 36px;
          font-weight: 800;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }
        .title {
          color: #111827;
          font-size: 28px;
          font-weight: 700;
          margin: 16px 0 8px;
        }
        .subtitle {
          color: #6b7280;
          font-size: 16px;
          margin: 0 0 32px;
        }
        .greeting {
          font-size: 18px;
          margin: 0 0 16px;
          font-weight: 600;
        }
        .description {
          font-size: 16px;
          color: #4b5563;
          margin: 0 0 24px;
          line-height: 1.7;
        }
        .success-notice {
          background: #f0fdf4;
          border: 1px solid #22c55e;
          border-radius: 12px;
          padding: 20px;
          margin: 32px 0;
          text-align: center;
        }
        .success-notice-title {
          font-weight: 700;
          color: #15803d;
          margin: 0 0 8px;
          font-size: 16px;
        }
        .success-notice-text {
          color: #166534;
          font-size: 14px;
          margin: 0;
        }
        .footer {
          text-align: center;
          color: #6b7280;
          font-size: 14px;
          margin-top: 40px;
          padding-top: 32px;
          border-top: 1px solid #e5e7eb;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header class="header">
          <h1 class="brand-logo">Quantis</h1>
          <h2 class="title">✅ Contraseña Actualizada</h2>
          <p class="subtitle">Tu cuenta está segura</p>
        </header>

        <main>
          <p class="greeting">Hola, ${name} 👋</p>

          <p class="description">
            Tu contraseña ha sido actualizada exitosamente. Tu cuenta está protegida y segura.
          </p>

          <div class="success-notice">
            <div class="success-notice-title">🔒 Cuenta Segura</div>
            <p class="success-notice-text">
              Si no realizaste este cambio, contacta nuestro soporte inmediatamente.
            </p>
          </div>
        </main>

        <footer class="footer">
          <p class="footer-title">Quantis — Tu aliado financiero</p>
          <p>Protegiendo tu dinero con tecnología de punta y atención humana.</p>
        </footer>
      </div>
    </body>
    </html>
  `;
};


// Función para reintentar envío de email con backoff exponencial
const retryEmailSend = async (transporter, mailOptions, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📧 Intento ${attempt}/${maxRetries} de envío de email`);
      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Email enviado exitosamente en intento ${attempt}:`, result.messageId);
      return { success: true, messageId: result.messageId, attempt };
    } catch (error) {
      console.error(`❌ Error en intento ${attempt}/${maxRetries}:`, error.message);
      
      // Si es el último intento, devolver el error
      if (attempt === maxRetries) {
        return { success: false, error: error.message, attempts: attempt };
      }
      
      // Esperar antes del siguiente intento (backoff exponencial)
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
      console.log(`⏳ Esperando ${delay}ms antes del siguiente intento...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Enviar email de reset de contraseña
const sendResetPasswordEmail = async (email, name, resetToken) => {
  try {
    console.log(`📧 Iniciando envío de email de reset para: ${email}`);
    const resetUrl = `${getPrimaryFrontendUrl()}/reset-password?token=${resetToken}`;

    // En modo desarrollo, mostrar el enlace en consola
    if (process.env.NODE_ENV === 'development') {
      console.log('🔗 Enlace de reset (desarrollo):', resetUrl);
    }

    // Usar Gmail SMTP
    console.log('📧 Usando Gmail SMTP para envío de email');
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Quantis" <${process.env.EMAIL_USER || 'noreply@quantis.com'}>`,
      to: email,
      subject: '🔐 Restablecer Contraseña - Quantis',
      html: getResetPasswordTemplate(name, resetUrl)
    };

    // Intentar enviar con reintentos (máximo 2 intentos)
    const result = await retryEmailSend(transporter, mailOptions, 2);

    if (result.success) {
      console.log(`✅ Email de reset enviado con Gmail SMTP después de ${result.attempt} intentos`);
      return { success: true, messageId: result.messageId };
    } else {
      console.error(`❌ Falló Gmail SMTP después de ${result.attempts} intentos:`, result.error);
      return { success: false, error: result.error };
    }

  } catch (error) {
    console.error('💥 Error crítico enviando email de reset:', error);
    return { success: false, error: error.message };
  }
};

// Enviar email de confirmación de cambio de contraseña
const sendPasswordChangedEmail = async (email, name) => {
  try {
    console.log(`📧 Iniciando envío de email de confirmación para: ${email}`);

    // Usar Gmail SMTP
    console.log('📧 Usando Gmail SMTP para email de confirmación');
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Quantis" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '✅ Contraseña Actualizada - Quantis',
      html: getPasswordChangedTemplate(name)
    };

    // Intentar enviar con reintentos (máximo 2 intentos)
    const result = await retryEmailSend(transporter, mailOptions, 2);

    if (result.success) {
      console.log(`✅ Email de confirmación enviado con Gmail SMTP después de ${result.attempt} intentos`);
      return { success: true, messageId: result.messageId };
    } else {
      console.error(`❌ Falló Gmail SMTP después de ${result.attempts} intentos:`, result.error);
      return { success: false, error: result.error };
    }

  } catch (error) {
    console.error('💥 Error crítico enviando email de confirmación:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendResetPasswordEmail,
  sendPasswordChangedEmail
};