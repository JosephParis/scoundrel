# Mobile Responsive Tests

Comprehensive Playwright tests for all mobile optimizations.

## Overview

These tests verify that:
- No scrolling is needed on mobile during gameplay
- All essential UI elements are visible
- Modals work correctly (Kit and Progress)
- Desktop layout remains unchanged
- The app works across different screen sizes

## Test Files

- **`mobile-responsive.spec.js`** - Main mobile responsive test suite

## Running Tests

### Run All Mobile Tests
```bash
npm run test:mobile
```

### Run Tests in UI Mode (Interactive)
```bash
npx playwright test visual/mobile-responsive.spec.js --ui
```

### Run Specific Test
```bash
npx playwright test visual/mobile-responsive.spec.js -g "should show compact header on mobile"
```

### Run Tests in Headed Mode (See Browser)
```bash
npx playwright test visual/mobile-responsive.spec.js --headed
```

### Debug a Test
```bash
npx playwright test visual/mobile-responsive.spec.js --debug
```

## Test Coverage

### 1. Descent View Tests (8 tests)
- ✅ Compact header visibility on mobile
- ✅ No vertical scrollbar during descent
- ✅ All room cards visible without scrolling
- ✅ Kit modal opens on button click
- ✅ Kit modal closes with Escape key
- ✅ Kit modal closes when clicking outside
- ✅ PhaseRail sidebar hidden on mobile
- ✅ Flee button visible without scrolling

### 2. Sanctuary View Tests (5 tests)
- ✅ Compact header visibility on mobile
- ✅ No vertical scrollbar in sanctuary
- ✅ Descend button visible without scrolling
- ✅ Progress modal opens on button click
- ✅ Progress modal closes with Escape key

### 3. Desktop Layout Tests (3 tests)
- ✅ Full sidebar visible on desktop (descent)
- ✅ Full sidebar visible on desktop (sanctuary)
- ✅ Mobile compact header hidden on desktop

### 4. Full Game Flow Tests (3 tests)
- ✅ Tutorial completion without scrolling
- ✅ Boon selection without scrolling
- ✅ Dynamic layout switching (mobile ↔ desktop)

### 5. Screen Size Tests (4 tests)
- ✅ iPhone SE (375×667)
- ✅ iPhone 12 (390×844)
- ✅ Small Android (360×640)
- ✅ Tablet Portrait (768×1024)

### 6. Touch Target Tests (2 tests)
- ✅ Minimum 44px touch targets
- ✅ Tappable flee button

**Total: 25 tests**

## Test Structure

Each test follows this pattern:

```javascript
test('description', async ({ page }) => {
  // 1. Set viewport size
  await page.setViewportSize(MOBILE_VIEWPORT)
  
  // 2. Navigate and interact
  await page.goto('/')
  await page.getByRole('button', { name: /Begin/i }).click()
  
  // 3. Verify expectations
  await expect(element).toBeVisible()
  await expect(element).toBeInViewport()
})
```

## Key Test Patterns

### Testing for No Scroll
```javascript
const bodyHeight = await page.evaluate(() => document.body.scrollHeight)
const viewportHeight = MOBILE_VIEWPORT.height
expect(bodyHeight).toBeLessThanOrEqual(viewportHeight + buffer)
```

### Testing Element Visibility
```javascript
await expect(element).toBeVisible()
await expect(element).toBeInViewport()
```

### Testing Modal Functionality
```javascript
// Open modal
await page.getByRole('button', { name: /Kit/i }).click()
await expect(page.getByRole('heading', { name: /Your kit/i })).toBeVisible()

// Close with Escape
await page.keyboard.press('Escape')
await expect(heading).not.toBeVisible()
```

### Testing Responsive Behavior
```javascript
// Mobile viewport
await page.setViewportSize({ width: 375, height: 667 })
await expect(mobileElement).toBeVisible()

// Desktop viewport
await page.setViewportSize({ width: 1920, height: 1080 })
await expect(mobileElement).not.toBeVisible()
await expect(desktopElement).toBeVisible()
```

## Viewports Tested

### Mobile Devices
- **iPhone SE**: 375×667 (smallest common device)
- **iPhone 12**: 390×844 (modern iPhone)
- **Small Android**: 360×640 (smallest Android target)

### Tablet/Desktop
- **Tablet Portrait**: 768×1024 (desktop layout kicks in)
- **Desktop**: 1920×1080 (full desktop)

## Common Issues and Fixes

### Test Timeout
If tests timeout waiting for elements:
```bash
npx playwright test --timeout=60000
```

### Screenshots on Failure
Tests automatically capture screenshots on failure:
```
test-results/
  mobile-responsive-should-show-compact-header/
    test-failed-1.png
```

### Video Recording
Enable video recording for debugging:
```javascript
// In playwright.config.js
use: {
  video: 'retain-on-failure'
}
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run mobile tests
  run: npm run test:mobile

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Adding New Tests

### Test Checklist
When adding a new mobile feature:

1. **Visibility Test**
   - [ ] Element visible on mobile
   - [ ] Element hidden/visible on desktop

2. **No Scroll Test**
   - [ ] Page height fits viewport
   - [ ] All interactive elements in viewport

3. **Interaction Test**
   - [ ] Buttons/links work correctly
   - [ ] Modals open/close properly

4. **Screen Size Test**
   - [ ] Works on smallest target (375×667)
   - [ ] Works on tablet breakpoint (768px)

5. **Touch Target Test**
   - [ ] Elements ≥ 44px in height
   - [ ] Adequate spacing between targets

### Example New Test
```javascript
test('should show new feature on mobile', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/')
  
  // Navigate to feature
  await page.getByRole('button', { name: /Feature/i }).click()
  
  // Verify visibility
  const feature = page.getByText(/Feature Name/i)
  await expect(feature).toBeVisible()
  await expect(feature).toBeInViewport()
  
  // Verify no scroll needed
  const bodyHeight = await page.evaluate(() => document.body.scrollHeight)
  expect(bodyHeight).toBeLessThanOrEqual(MOBILE_VIEWPORT.height + 50)
})
```

## Performance Testing

### Measuring Layout Shift
```javascript
test('should have minimal layout shift', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/')
  
  // Measure CLS
  const cls = await page.evaluate(() => {
    return new Promise((resolve) => {
      let clsValue = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
          }
        }
        resolve(clsValue)
      }).observe({ type: 'layout-shift', buffered: true })
      
      setTimeout(() => resolve(clsValue), 5000)
    })
  })
  
  expect(cls).toBeLessThan(0.1) // Good CLS score
})
```

## Accessibility Testing

### Keyboard Navigation
```javascript
test('should navigate with keyboard', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/')
  
  // Tab through elements
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  
  // Should focus on Kit button
  const kitButton = page.getByRole('button', { name: /Kit/i })
  await expect(kitButton).toBeFocused()
})
```

## Troubleshooting

### Dev Server Not Starting
```bash
# Check if port is in use
netstat -ano | findstr :5173

# Kill process if needed
taskkill /PID <PID> /F

# Restart tests
npm run test:mobile
```

### Flaky Tests
If tests are flaky (intermittent failures):

1. **Add explicit waits**
   ```javascript
   await page.waitForSelector('.card-face', { timeout: 5000 })
   ```

2. **Increase timeout**
   ```javascript
   test.setTimeout(60000)
   ```

3. **Use auto-waiting assertions**
   ```javascript
   await expect(element).toBeVisible({ timeout: 10000 })
   ```

### Tests Pass Locally But Fail in CI
- Check viewport sizes match
- Ensure fonts are loaded
- Verify animations complete
- Check for race conditions

## Next Steps

### Future Test Coverage
- [ ] Landscape mode optimization tests
- [ ] Slow network simulation
- [ ] Touch gesture tests (swipe, pinch)
- [ ] Cross-browser testing (Safari, Firefox)
- [ ] Visual regression tests
- [ ] Performance benchmarks

### Integration with Other Tests
These tests complement existing:
- `screens.spec.js` - Visual regression tests
- `tutorial-walkthrough.spec.js` - Tutorial flow tests

## Useful Commands

```bash
# Run all tests
npx playwright test

# Run only mobile tests
npx playwright test visual/mobile-responsive.spec.js

# Run in UI mode (best for development)
npx playwright test --ui

# Run and show browser
npx playwright test --headed

# Debug specific test
npx playwright test --debug -g "compact header"

# Generate HTML report
npx playwright show-report

# Update snapshots (if using visual regression)
npx playwright test --update-snapshots
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Mobile Testing Guide](https://playwright.dev/docs/emulation)
- [Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
