# TaleForge Email Template Customization Guide

## How to Customize Supabase Email Templates

### 1. Access Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **Authentication → Email Templates**

### 2. Customize Email Confirmation Template

**Current Template (Generic):**
```
Confirm your signup. Follow this link to confirm your user.
Confirm your email
```

**Recommended TaleForge Template:**

**Subject:** Welcome to TaleForge - Confirm Your Account

**Email Body:**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to TaleForge</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #C4A574; margin: 0;">📚 TaleForge</h1>
        <p style="color: #666; margin: 5px 0;">Where Stories Come Alive</p>
    </div>
    
    <div style="background: #f8f5f0; padding: 30px; border-radius: 10px; border-left: 4px solid #C4A574;">
        <h2 style="color: #2c3e50; margin-top: 0;">Welcome to the Adventure! 🎉</h2>
        
        <p>Thank you for joining <strong>TaleForge</strong>! We're excited to have you as part of our community of storytellers and readers.</p>
        
        <p>To start creating and exploring interactive stories, please confirm your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{ .ConfirmationURL }}" 
               style="background-color: #C4A574; color: #0D0D0D; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                ✨ Confirm My Account ✨
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
            This link will expire in 24 hours for security reasons.
        </p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="font-size: 14px; color: #666;">
            <strong>What can you do with TaleForge?</strong><br>
            • Create interactive stories with branching narratives<br>
            • Share your stories with readers worldwide<br>
            • Explore stories created by other writers<br>
            • Engage with the community through reactions and feedback
        </p>
        
        <p style="font-size: 14px; color: #666;">
            If you didn't create this account, you can safely ignore this email.
        </p>
    </div>
    
    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
            Questions? Contact us at <a href="mailto:support@taleforge.com" style="color: #C4A574;">support@taleforge.com</a>
        </p>
        <p style="color: #999; font-size: 12px;">
            © 2024 TaleForge. All rights reserved.
        </p>
    </div>
</body>
</html>
```

### 3. Additional Email Templates to Customize

**Password Reset Template:**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reset Your TaleForge Password</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #C4A574; margin: 0;">📚 TaleForge</h1>
    </div>
    
    <div style="background: #f8f5f0; padding: 30px; border-radius: 10px; border-left: 4px solid #C4A574;">
        <h2 style="color: #2c3e50; margin-top: 0;">Reset Your Password 🔐</h2>
        
        <p>We received a request to reset your TaleForge password. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{ .ConfirmationURL }}" 
               style="background-color: #C4A574; color: #0D0D0D; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Reset My Password
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour for security reasons.
        </p>
        
        <p style="font-size: 14px; color: #666;">
            If you didn't request this password reset, you can safely ignore this email.
        </p>
    </div>
</body>
</html>
```

### 4. Template Variables Available

Supabase provides these variables you can use in templates:
- `{{ .ConfirmationURL }}` - The confirmation link
- `{{ .Email }}` - User's email address  
- `{{ .SiteURL }}` - Your site URL
- `{{ .Token }}` - The confirmation token

### 5. Testing Email Templates

1. Go to **Authentication → Email Templates** in Supabase
2. Make your changes
3. Use the "Send test email" feature to preview
4. Test with different email clients (Gmail, Outlook, etc.)

### 6. Additional Tips

- **Branding**: Use TaleForge colors (#C4A574, #0D0D0D, #E8D5B7)
- **Mobile-friendly**: Ensure templates work on mobile devices
- **Accessibility**: Include alt text for images, good color contrast
- **Plain text fallback**: Supabase automatically creates plain text versions
- **Sender name**: Set a custom sender name like "TaleForge Team"

This will transform your generic Supabase emails into beautiful, branded communications that enhance the user experience!
