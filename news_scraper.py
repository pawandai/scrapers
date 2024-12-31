import requests
from bs4 import BeautifulSoup
import csv
from datetime import datetime

# Define the URL of the homepage
url = 'https://www.sharesansar.com/category/nepse-news'
headers = {'User-Agent': 'Mozilla/5.0'}

def scrape_homepage():
    # Send an HTTP request to the homepage
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        soup = BeautifulSoup(response.content, 'html.parser')
        # Adjust the following selectors based on the site's structure
        articles = soup.find_all('div', class_='featured-news-list')  # Update based on actual HTML structure
        news_data = []
        for article in articles:
            # Extract title and date
            title_element = article.find('h4')
            # print(title_element)
            date_element = article.find('p')
            # print(date_element)

            title = title_element.get_text(strip=True) if title_element else 'No title found'
            
            date = date_element.get_text(strip=True) if date_element else 'No date found'

            news_data.append({'Title': title, 'Date': date})
        return news_data
    else:
        print(f"Failed to fetch the homepage. Status code: {response.status_code}")
        return []

def save_to_csv(news_articles, filename='data/news/news_data.csv'):
    try:
        with open(filename, 'r', newline='', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            existing_titles = {row['Title'] for row in reader}
    except FileNotFoundError:
        existing_titles = set()

    new_data = []
    for article in news_articles:
        if article['Title'] not in existing_titles:
            # Convert date format
            date_str = article['Date']
            try:
                date_obj = datetime.strptime(date_str, "%A, %B %d, %Y")
                formatted_date = date_obj.strftime("%m/%d/%Y")
                article['Date'] = formatted_date
            except ValueError:
                print(f"Date format error for: {date_str}")
                continue
            new_data.append(article)

    if new_data:
        with open(filename, 'r', newline='', encoding='utf-8') as file:
            reader = list(csv.DictReader(file))
        
        with open(filename, 'w', newline='', encoding='utf-8') as file:
            writer = csv.DictWriter(file, fieldnames=['Date', 'Title'])
            writer.writeheader()
            for article in new_data:
                writer.writerow(article)
            for row in reader:
                writer.writerow(row)

        print(f'Data saved to {filename}')
    else:
        print('No new articles to save')

if __name__ == '__main__':
    news_articles = scrape_homepage()
    if news_articles:
        save_to_csv(news_articles)
    else:
        print("No articles found to save.")
