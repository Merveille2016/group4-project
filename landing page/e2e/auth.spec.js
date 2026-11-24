import { test, expect } from '@playwright/test'
import * as OTPAuth from 'otpauth'

const API = 'http://localhost:5055'
const PASSWORD = 'correct-horse-battery'

let counter = 0
const newEmail = () => `user${Date.now()}${counter++}@uniguide.cm`

const totp = (secret, offsetSteps = 0) => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) })
  .generate({ timestamp: Date.now() + offsetSteps * 30000 })

async function signUp(page, email, password = PASSWORD) {
  await page.goto('/signup')
  await page.getByLabel('Full name').fill('Jane Doe')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Your account has been created')).toBeVisible()
}

// The login fields are read only until clicked, to stop browser autofill
async function enterPassword(page, email, password = PASSWORD) {
  if (!page.url().endsWith('/login')) await page.goto('/login')
  await page.getByLabel('Email').click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).click()
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

async function logIn(page, email, password = PASSWORD) {
  await enterPassword(page, email, password)
  await expect(page.locator('button.login-button', { hasText: 'Logout' })).toBeVisible()
}

async function logOut(page) {
  await page.locator('button.login-button', { hasText: 'Logout' }).click()
  await expect(page.locator('button.login-button', { hasText: 'Logout' })).toHaveCount(0)
}

// Turns on 2FA from the dashboard and returns the secret and backup codes
async function enableTwoFactor(page) {
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Set up two factor authentication' }).click()
  await expect(page.getByAltText('QR code for your authenticator app')).toBeVisible()
  const secret = (await page.locator('.secret-key').innerText()).replace(/\s/g, '')

  await page.getByLabel('Enter the 6 digit code the app shows').fill(totp(secret))
  await page.getByRole('button', { name: 'Turn on' }).click()

  await expect(page.getByRole('list', { name: 'Backup codes' }).locator('li')).toHaveCount(10)
  const codes = await page.getByRole('list', { name: 'Backup codes' }).locator('li').allInnerTexts()
  expect(codes).toHaveLength(10)
  await page.getByRole('button', { name: 'I’ve saved them' }).click()
  await expect(page.getByText('10 backup codes left')).toBeVisible()
  return { secret, codes }
}

test('password reset from the login page', async ({ page, request }) => {
  const email = newEmail()
  await signUp(page, email)

  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByText('If an account exists for that email')).toBeVisible()

  const { link } = await (await request.get(`${API}/e2e/reset-link?email=${encodeURIComponent(email)}`)).json()
  const resetUrl = new URL(link)
  await page.goto(resetUrl.pathname + resetUrl.search)

  await page.getByLabel('New password', { exact: true }).fill('short')
  await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()
  await page.getByLabel('New password', { exact: true }).fill('a-brand-new-password')
  await page.getByLabel('Confirm new password').fill('a-brand-new-password')
  await page.getByRole('button', { name: 'Reset password' }).click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Your password has been reset')).toBeVisible()

  await enterPassword(page, email, PASSWORD)
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password')
  await logIn(page, email, 'a-brand-new-password')

  // The link only works once
  await logOut(page)
  await page.goto(resetUrl.pathname + resetUrl.search)
  await page.getByLabel('New password', { exact: true }).fill('another-new-password')
  await page.getByLabel('Confirm new password').fill('another-new-password')
  await page.getByRole('button', { name: 'Reset password' }).click()
  await expect(page.getByRole('alert')).toContainText('invalid or has expired')
  await expect(page.getByRole('link', { name: 'Request a new link' })).toBeVisible()
})

test('a reset link without a token asks for a new one', async ({ page }) => {
  await page.goto('/reset-password')
  await expect(page.getByRole('alert')).toContainText('incomplete')
  await page.getByRole('link', { name: 'Request a new link' }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
})

test('enrolment, login with a code, backup code recovery and turning it off', async ({ page }) => {
  const email = newEmail()
  await signUp(page, email)
  await logIn(page, email)
  const { secret, codes } = await enableTwoFactor(page)
  await logOut(page)

  // Password alone now leads to the code screen, not a session
  await enterPassword(page, email)
  await expect(page.getByRole('heading', { name: 'Two factor check' })).toBeVisible()
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)

  await enterPassword(page, email)
  await page.getByLabel('Code', { exact: true }).fill('000000')
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByRole('alert')).toHaveText('That code is not right. Please try again.')

  // The enrolment code was already used, so take the next one
  await page.getByLabel('Code', { exact: true }).fill(totp(secret, 1))
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByRole('button', { name: 'Logout' }).first()).toBeVisible()
  await page.goto('/dashboard')
  await expect(page.getByText('Signing in needs your password and a code from your phone')).toBeVisible()
  await logOut(page)

  await enterPassword(page, email)
  await page.getByRole('button', { name: 'Lost your phone? Use a backup code' }).click()
  await page.getByLabel('Backup code', { exact: true }).fill(codes[0])
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page).toHaveURL(/localhost:\d+\/$/)
  await page.locator('nav').getByRole('link', { name: 'Dashboard' }).first().click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('You signed in with a backup code. You have 9 left.')).toBeVisible()
  await logOut(page)

  // A used backup code doesn't work again
  await enterPassword(page, email)
  await page.getByRole('button', { name: 'Lost your phone? Use a backup code' }).click()
  await page.getByLabel('Backup code', { exact: true }).fill(codes[0])
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByRole('alert')).toHaveText('That code is not right. Please try again.')
  await page.getByLabel('Backup code', { exact: true }).fill(codes[1])
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page).toHaveURL(/localhost:\d+\/$/)
  await page.goto('/dashboard')

  await page.getByRole('button', { name: 'Turn off' }).click()
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Code from your app, or a backup code').fill(codes[2])
  await page.getByRole('button', { name: 'Turn off' }).click()
  await expect(page.getByText('Add a second step to signing in')).toBeVisible()
  await logOut(page)

  await enterPassword(page, email)
  await expect(page.getByRole('heading', { name: 'Two factor check' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Logout' }).first()).toBeVisible()
})

test('new backup codes replace the old ones', async ({ page }) => {
  const email = newEmail()
  await signUp(page, email)
  await logIn(page, email)
  const { secret, codes } = await enableTwoFactor(page)

  await page.getByRole('button', { name: 'New backup codes' }).click()
  await page.getByLabel('Code from your authenticator app').fill(totp(secret, 1))
  await page.getByRole('button', { name: 'Create new codes' }).click()
  await expect(page.getByRole('list', { name: 'Backup codes' }).locator('li')).toHaveCount(10)
  const fresh = await page.getByRole('list', { name: 'Backup codes' }).locator('li').allInnerTexts()
  expect(fresh).toHaveLength(10)
  expect(fresh).not.toContain(codes[0])
  await page.getByRole('button', { name: 'I’ve saved them' }).click()
  await logOut(page)

  // Backup codes also work in the main code field
  await enterPassword(page, email)
  await page.getByLabel('Code', { exact: true }).fill(codes[0])
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByRole('alert')).toHaveText('That code is not right. Please try again.')
  await page.getByLabel('Code', { exact: true }).fill(fresh[0])
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page).toHaveURL(/localhost:\d+\/$/)
  await page.locator('nav').getByRole('link', { name: 'Dashboard' }).first().click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('You signed in with a backup code. You have 9 left.')).toBeVisible()
})

test('a timed out code step sends the person back to the password', async ({ page, context }) => {
  const email = newEmail()
  await signUp(page, email)
  await logIn(page, email)
  const { secret } = await enableTwoFactor(page)
  await logOut(page)

  await enterPassword(page, email)
  await expect(page.getByRole('heading', { name: 'Two factor check' })).toBeVisible()
  await context.clearCookies({ name: 'uniguide.pa' })

  await page.getByLabel('Code', { exact: true }).fill(totp(secret, 1))
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('enter your password again')
})

test('the refresh cookie keeps the login going after the session cookie is gone', async ({ page, context }) => {
  const email = newEmail()
  await signUp(page, email)
  await logIn(page, email)
  await page.goto('/dashboard')
  await expect(page.getByText('Session verified')).toBeVisible()

  await context.clearCookies({ name: 'uniguide.sid' })
  await page.reload()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('Session verified')).toBeVisible()
})

test('route guards keep logged out people off the dashboard', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})
