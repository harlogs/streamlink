import os
import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.action_chains import ActionChains

# ---------- CONFIG ----------
PINTEREST_EMAIL = os.environ.get("PINTEREST_EMAIL") or "meetwill9222@gmail.com"
PINTEREST_PASSWORD = os.environ.get("PINTEREST_PASSWORD") or "22@Willas@22"
SESSION_FILE = "pinterest_session.json"
PIN_CREATOR_URL = "https://www.pinterest.com/pin-builder/"

# ---------- SESSION HELPERS ----------
# def save_cookies(driver, path=SESSION_FILE):
#     with open(path, "w") as f:
#         json.dump(driver.get_cookies(), f)
#     print("💾 Session saved")

# def load_cookies(driver, path=SESSION_FILE):
#     if not os.path.exists(path):
#         return False
#     with open(path, "r") as f:
#         cookies = json.load(f)
#     for cookie in cookies:
#         cookie.setdefault("sameSite", "Lax")
#         try:
#             driver.add_cookie(cookie)
#         except Exception:
#             pass
#     print("♻️ Session loaded")
#     return True

# def is_logged_in(driver):
#     driver.get("https://www.pinterest.com/")
#     time.sleep(3)
#     try:
#         driver.find_element(By.XPATH, "//div[@data-test-id='header-profile-image']")
#         return True
#     except:
#         return False

# ---------- LOGIN ----------
def smart_login(driver, wait):
    driver.get("https://www.pinterest.com/login/")
    time.sleep(2)

    try:
        if driver.find_elements(By.NAME, "id") and driver.find_elements(By.NAME, "password"):
            print("🪄  One-step login")
            driver.find_element(By.NAME, "id").send_keys(PINTEREST_EMAIL)
            driver.find_element(By.NAME, "password").send_keys(PINTEREST_PASSWORD + Keys.RETURN)
        elif driver.find_elements(By.NAME, "id"):
            print("🪄  Two-step login")
            driver.find_element(By.NAME, "id").send_keys(PINTEREST_EMAIL)
            driver.find_element(By.XPATH, "//button//div[text()='Continue']").click()
            wait.until(EC.presence_of_element_located((By.NAME, "password")))
            driver.find_element(By.NAME, "password").send_keys(PINTEREST_PASSWORD + Keys.RETURN)
        else:
            raise Exception("Login form not found")

        #wait.until(EC.presence_of_element_located((By.XPATH, "//div[@data-test-id='header-profile-image']")))
        print("✅ Logged in successfully")
        # save_cookies(driver)
        time.sleep(5)
    except Exception as e:
        print(f"🔥 Login failed: {e}")
        raise

# ---------- CREATE PIN ----------
def create_pin(title, description, alt_text, link, image_path=None):
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--disable-notifications")
    chrome_options.add_argument("--disable-popup-blocking")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    wait = WebDriverWait(driver, 30)

    try:
        #cookies_loaded = load_cookies(driver)
        driver.get("https://www.pinterest.com/")
        time.sleep(3)

        # if load_cookies(driver) and is_logged_in(driver):
        #     print("✅ Logged in via cookies")
        #     driver.refresh()
        #     time.sleep(3)
        # else:
        #     print("🔑 No valid session — logging in manually")
        smart_login(driver, wait)
        safe_go_to_pin_builder(driver, wait)

        if image_path and os.path.exists(image_path):
            upload_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='file']")))
            upload_input.send_keys(image_path)
            print("📸 Image uploaded")
            time.sleep(3)

            # --- TITLE ---
            try:
                title_input = WebDriverWait(driver, 20).until(
                    EC.presence_of_element_located(
                        (By.XPATH, "//textarea[contains(@id,'pin-draft-title')]")
                    )
                )
                title_input.click()
                title_input.clear()
                title_input.send_keys(title)
                print("📝 Title entered")
            except Exception as e:
                print("⚠️ Title input not found:", e)

            # --- DESCRIPTION ---
            try:
                desc_container = WebDriverWait(driver, 20).until(
                    EC.presence_of_element_located(
                        (By.XPATH, "//div[@aria-label='Tell everyone what your Pin is about' and @contenteditable='true']")
                    )
                )
                # Click to focus
                actions = ActionChains(driver)
                actions.move_to_element(desc_container).click().perform()
                time.sleep(0.5)
                desc_container.send_keys(description)
                time.sleep(1)
                print("📝 Description entered")
            except Exception as e:
                print("⚠️ Description input not found:", e)

            # --- DESTINATION LINK ---
            try:
                link_input = WebDriverWait(driver, 20).until(
                    EC.presence_of_element_located(
                        (By.XPATH, "//textarea[contains(@id,'pin-draft-link')]")
                    )
                )
                link_input.click()
                link_input.clear()
                link_input.send_keys(link)
                time.sleep(1)
                print("🔗 Destination link entered")
            except Exception as e:
                print("⚠️ Destination link input not found:", e)

        
            # --- CLICK "Add alt text" ---
            try:
                alt_button = WebDriverWait(driver, 20).until(
                    EC.element_to_be_clickable(
                        (By.XPATH, "//div[@data-test-id='pin-draft-alt-text-button']//div[text()='Add alt text']")
                    )
                )
                alt_button.click()
                time.sleep(3)
                print("✅ 'Add alt text' button clicked")
                actions = ActionChains(driver)
                # actions.move_to_element(alt_text_input)
                # actions.click()
                actions.send_keys(alt_text)
                actions.perform()
                time.sleep(2)  # Wait for the input to appear
            except Exception as e:
                print("⚠️ Could not click 'Add alt text':", e)


            try:
                publish_btn = WebDriverWait(driver, 20).until(
                    EC.element_to_be_clickable(
                        (By.XPATH, "//div[@data-test-id='board-dropdown-save-button']//div[contains(text(),'Publish')]")
                    )
                )
                publish_btn.click()
                time.sleep(10)
                print("✅ Pin published successfully")
            except Exception as e:
                print("⚠️ Could not click Publish button:", e)
    except Exception as e:
        print(f"🔥 Error: {e}")
    finally:
        time.sleep(5)
        driver.quit()

def safe_go_to_pin_builder(driver, wait):
    try:
        driver.get(PIN_CREATOR_URL)
        print("➡️  Navigating to pin builder...")
        time.sleep(5)
        print("📝 Pin builder opened successfully!")
    except TimeoutException:
        print("⚠️ Timeout waiting for Pin Builder — retrying once...")
        driver.get("https://www.pinterest.com/")
        time.sleep(3)
        driver.get(PIN_CREATOR_URL)
        try:
            print("✅ Pin builder opened on retry")
        except TimeoutException:
            print("❌ Failed to open Pin Builder after retry")
    time.sleep(10)

# # ---------- TEST ----------
# if __name__ == "__main__":
#     title = "Sample Movie Title"
#     description = "This is a description of the movie"
#     alt_text = "Movie Poster Alt Text"
#     link = "https://movies.technologymanias.com/sample-movie"
#     image_path = os.path.join(os.getcwd(), "logo.png")

#     create_pin(title, description, alt_text, link, image_path)
