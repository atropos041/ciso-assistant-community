import { LoginPage } from '../utils/login-page.js';
import { SideBar } from '../utils/sidebar.js';
import { test, expect, setHttpResponsesListener, TestContent } from '../utils/test-utils.js';

let vars = TestContent.generateTestVars();

test.describe.configure({mode: 'serial'});
test.beforeEach('create user', async ({page}) => {
    setHttpResponsesListener(page);
});

test('user can set his password', async ({
    logedPage,
    usersPage,
    foldersPage,
    sideBar,
	mailer,
	page
}) => {
    await foldersPage.goto();
    await foldersPage.createItem({
        name: vars.folderName,
        description: vars.description
    });

    await usersPage.goto();
    await usersPage.createItem({
        email: vars.user.email
    });

    await usersPage.editItemButton(vars.user.email).click();
    await usersPage.form.fill({
        first_name: vars.user.firstName,
        last_name: vars.user.lastName, 
        user_groups: [
            `${vars.folderName} - ${vars.usergroups.analyst}`,
            `${vars.folderName} - ${vars.usergroups.auditor}`,
            `${vars.folderName} - ${vars.usergroups.domainManager}`,
            `${vars.folderName} - ${vars.usergroups.approver}`,
        ],
    });
    await usersPage.form.saveButton.click();
    await usersPage.isToastVisible('.+ successfully saved: ' + vars.user.email);

    await sideBar.moreButton.click();
    await expect(sideBar.morePanel).not.toHaveAttribute('inert');
    await expect(sideBar.logoutButton).toBeVisible();
    await sideBar.logoutButton.click();
    await logedPage.hasUrl(0);

    await expect(mailer.page.getByText('{{').last()).toBeHidden(); // Wait for mailhog to load the emails
    const lastMail = await mailer.getLastEmail();
    await lastMail.hasWelcomeEmailDetails();
    await lastMail.hasEmailRecipient(vars.user.email);
    
    await lastMail.open();
    const pagePromise = page.context().waitForEvent('page');
    await mailer.emailContent.setPasswordButton.click();
    const setPasswordPage = await pagePromise;
    await setPasswordPage.waitForLoadState();
    await expect(setPasswordPage).toHaveURL(await mailer.emailContent.setPasswordButton.getAttribute('href') || 'Set password link could not be found');

    const setLoginPage = new LoginPage(setPasswordPage);
    await setLoginPage.newPasswordInput.fill(vars.user.password);
    await setLoginPage.confirmPasswordInput.fill(vars.user.password);
    await setLoginPage.setPasswordButton.click();
    
    await setLoginPage.isToastVisible('Your password was successfully set. Welcome to CISO Assistant.');

    await setLoginPage.login(vars.user.email, vars.user.password);
    await expect(setLoginPage.page).toHaveURL('/analytics');

    // logout to prevent sessions conflicts
    const passwordPageSideBar = new SideBar(setPasswordPage);
    await passwordPageSideBar.moreButton.click();
    await expect(passwordPageSideBar.morePanel).not.toHaveAttribute('inert');
    await expect(passwordPageSideBar.logoutButton).toBeVisible();
    await passwordPageSideBar.logoutButton.click();
    await setLoginPage.hasUrl(0);

    await setPasswordPage.close(); 
});

test('user can view his folder', async ({loginPage, foldersPage, page}) => {
    await loginPage.goto();
    await loginPage.login(vars.user.email, vars.user.password);
    await expect(page).toHaveURL('/analytics');
    await foldersPage.goto();
    await expect(foldersPage.getRow(vars.folderName)).toBeVisible();
});

test.afterEach('cleanup', async ({ loginPage, foldersPage, usersPage, page }, testInfo) => {
    if (testInfo.testId.includes('user can view his folder')) {
        await loginPage.login();
        await foldersPage.goto();
        await foldersPage.deleteItemButton(vars.folderName).click();
        await foldersPage.deleteModalConfirmButton.click();
        await expect(foldersPage.getRow(vars.folderName)).not.toBeVisible();
        await usersPage.goto();
        await usersPage.deleteItemButton(vars.user.email).click();
        await usersPage.deleteModalConfirmButton.click();
        await expect(usersPage.getRow(vars.user.email)).not.toBeVisible();
    }
});
