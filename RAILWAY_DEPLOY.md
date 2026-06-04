# Railway Deployment

This version is prepared for Railway with a Node web service and a Railway MySQL database.

## 1. Create the Railway project

1. Open Railway and create a new project.
2. Add a MySQL database service.
3. Add this app as a service from GitHub or by uploading/deploying the project.

Railway MySQL provides `MYSQL_URL`; the app now uses that automatically.

## 2. Required variables

Set these on the app service:

```text
ADMIN_PASSWORD=choose-a-strong-admin-password
JWT_SECRET=generate-a-long-random-secret
NODE_ENV=production
VITE_APP_ID=kokomo-lift-booking
```

Optional email and Google Calendar variables can be added later if you want automated email/calendar integration.

## 3. Build and start

Railway will read `railway.json`:

```text
Build: pnpm build
Pre-deploy: pnpm db:push
Start: pnpm start
```

## 4. Admin access

After deployment:

1. Open `/admin`.
2. Enter the `ADMIN_PASSWORD` value.
3. Manage, confirm, reject, cancel, and export bookings.

## 5. Custom domain

After the Railway deployment works, add your custom domain in Railway and update DNS at your domain provider. Keep the old Manus site active until the Railway site is tested.
