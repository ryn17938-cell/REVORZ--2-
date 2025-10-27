// tests/e2e/basic.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Basic E-commerce Flow', () => {
  test('should allow a user to browse products and add to cart', async ({ page }) => {
    // Go to the home page
    await page.goto('http://localhost:8888/'); // Assuming your app runs on port 8888

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/REVOZ/);

    // Click on "Katalog" link
    await page.click('text=Katalog');
    await expect(page).toHaveURL(/.*catalog/);

    // Click on the first product
    await page.locator('.product-card a').first().click();
    await expect(page).toHaveURL(/.*product\/\d+/);

    // Select a color (if available)
    const colorSelect = await page.$('#color');
    if (colorSelect) {
      await colorSelect.selectOption({ index: 1 }); // Select the second option
    }

    // Select a size (if available)
    const sizeSelect = await page.$('#size');
    if (sizeSelect) {
      await sizeSelect.selectOption({ index: 1 }); // Select the second option
    }

    // Click "Tambahkan ke Keranjang" button
    await page.click('#add-to-cart-btn');

    // Expect a success message (you might need to adjust the selector for your popup)
    await expect(page.locator('.popup-notification.success')).toBeVisible();

    // Go to cart
    await page.click('a[href="/cart"]');
    await expect(page).toHaveURL(/.*cart/);

    // Expect the cart to contain at least one item
    await expect(page.locator('.cart-item')).toBeVisible();
  });

  test('Admin should be able to login and view dashboard', async ({ page }) => {
    // Go to login page
    await page.goto('http://localhost:8888/login');

    // Fill in admin credentials (replace with actual admin credentials)
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'adminpassword'); // Replace with actual admin password

    // Click login button
    await page.click('button[type="submit"]');

    // Expect to be redirected to the home page or dashboard
    await expect(page).toHaveURL(/http:\/\/localhost:8888\/(admin\/dashboard)?/); // Adjust if admin redirects to home

    // Navigate to admin dashboard
    await page.goto('http://localhost:8888/admin/dashboard');
    await expect(page).toHaveURL(/.*admin\/dashboard/);

    // Expect dashboard content to be visible
    await expect(page.locator('h1', { hasText: 'Admin Dashboard' })).toBeVisible();
    await expect(page.locator('text=Total Penjualan')).toBeVisible();
  });
});
