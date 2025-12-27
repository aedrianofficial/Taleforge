# Supabase Storage Setup for Profile Pictures

## 🚀 Quick Setup Guide

### 1. Create the Avatars Bucket

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Click on **Storage** in the left sidebar
4. Click **"New bucket"**
5. Enter the following details:
   - **Name**: `avatars`
   - **Public bucket**: ✅ **Check this box** (Enable public access)
   - **File size limit**: 5MB (recommended)
   - **Allowed MIME types**: Leave empty or add: `image/jpeg, image/jpg, image/png`
6. Click **"Create bucket"**

### 2. Configure Storage Policies

After creating the bucket, you need to set up policies for uploads:

1. In the Storage page, click on the `avatars` bucket
2. Click on **"Policies"** tab
3. Click **"New Policy"**

#### Policy 1: Allow Public Read Access
```sql
-- Policy Name: Public Access
-- Allowed operation: SELECT

CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );
```

#### Policy 2: Allow Authenticated Users to Upload
```sql
-- Policy Name: Authenticated users can upload avatars
-- Allowed operation: INSERT

CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );
```

#### Policy 3: Allow Users to Update Their Own Avatars
```sql
-- Policy Name: Users can update own avatars
-- Allowed operation: UPDATE

CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' )
WITH CHECK ( bucket_id = 'avatars' );
```

#### Policy 4: Allow Users to Delete Their Own Avatars
```sql
-- Policy Name: Users can delete own avatars
-- Allowed operation: DELETE

CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'avatars' );
```

### 3. Alternative: Quick Policy Setup (All Operations)

If you want to quickly enable all operations for authenticated users:

```sql
-- Policy Name: Authenticated users can manage avatars
-- Allowed operations: ALL

CREATE POLICY "Authenticated users can manage avatars"
ON storage.objects
FOR ALL
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );

-- Public read access
CREATE POLICY "Public Access to avatars"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );
```

### 4. Verify Setup

After setting up, verify your configuration:

1. **Check Bucket Exists**: 
   - Go to Storage → You should see `avatars` bucket
   
2. **Check Public Access**: 
   - The bucket should show a 🌐 globe icon indicating it's public
   
3. **Test Upload**: 
   - Try uploading a profile picture from the app
   - Check the browser console or React Native logs for detailed error messages

### 5. Common Issues & Solutions

#### ❌ "Bucket not found"
**Solution**: Create the `avatars` bucket (Step 1)

#### ❌ "Network request failed"
**Solutions**:
- Check your Supabase project is active (not paused)
- Verify your `EXPO_PUBLIC_SUPABASE_URL` in `.env` is correct
- Check your internet connection
- Ensure CORS is enabled (usually automatic for Supabase)

#### ❌ "Permission denied" / "policies"
**Solution**: Set up the storage policies (Step 2)

#### ❌ "Row Level Security" errors
**Solution**: Make sure public access is enabled on the bucket

### 6. Check Your Supabase URL

In your `.env` or config file, verify:
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 7. Test the Setup

Run this command to test your configuration:
```bash
# Check if you can access storage
curl https://YOUR-PROJECT-ID.supabase.co/storage/v1/bucket/avatars
```

## ✅ Success Indicators

When properly configured, you should be able to:
- ✅ Upload profile pictures without errors
- ✅ View uploaded avatars immediately
- ✅ Update/replace existing avatars
- ✅ See avatar URLs in format: `https://YOUR-PROJECT.supabase.co/storage/v1/object/public/avatars/avatar-UUID-timestamp.jpg`

## 📝 Notes

- Avatar files are stored with naming pattern: `avatar-{userId}-{timestamp}.jpg`
- Old avatars are replaced automatically (upsert: true)
- Maximum recommended file size: 5MB
- Supported formats: JPEG, PNG
- Images are compressed to 70% quality before upload

## 🆘 Still Having Issues?

Check the console logs for detailed error messages:
- Look for "Error uploading avatar:" in the logs
- Check "Error details:" for specific Supabase error responses
- Verify your Supabase project is not paused
- Ensure you're logged in (authenticated)

---

**Last Updated**: December 2025

