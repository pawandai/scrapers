import pandas as pd
from nltk.sentiment.vader import SentimentIntensityAnalyzer
import nltk
from datetime import timedelta
import os

# Download VADER lexicon
nltk.download('vader_lexicon')

# Initialize VADER sentiment analyzer
sia = SentimentIntensityAnalyzer()

# Load news data
news_df = pd.read_csv('./data/news/raw_news.csv')
news_df['published_date'] = pd.to_datetime(news_df['published_date'], errors='coerce')
news_df = news_df.dropna(subset=['published_date'])

# Function to compute sentiment score
def get_sentiment_score(text):
    return sia.polarity_scores(text)['compound']

# Apply function to compute sentiment scores
news_df['sentiment_score'] = news_df['Title'].apply(get_sentiment_score)

# Aggregate by date to get average sentiment score per day
daily_sentiment = news_df.groupby(news_df['published_date'].dt.date)['sentiment_score'].mean().reset_index()
daily_sentiment['published_date'] = pd.to_datetime(daily_sentiment['published_date'])

# Function to calculate Sunday sentiment
def calculate_sunday_sentiment(daily_sentiment):
    sunday_sentiments = []
    for date in daily_sentiment['published_date']:
        if date.weekday() == 6:  # Sunday
            # Calculate dates for Friday, Saturday, and Sunday
            friday = date - timedelta(days=2)
            saturday = date - timedelta(days=1)
            sunday = date
            # Filter news from Friday, Saturday, and Sunday
            mask = daily_sentiment['published_date'].isin([friday, saturday, sunday])
            avg_sentiment = daily_sentiment[mask]['sentiment_score'].mean()
            sunday_sentiments.append({'published_date': sunday, 'sentiment_score': avg_sentiment})
    return pd.DataFrame(sunday_sentiments)

# Calculate Sunday sentiments
sunday_sentiment_df = calculate_sunday_sentiment(daily_sentiment)

# Combine daily sentiment with Sunday sentiment
combined_sentiment = pd.concat([daily_sentiment, sunday_sentiment_df]).drop_duplicates(subset='published_date').reset_index(drop=True)

# Directory containing stock data files
stock_data_directory = "./data/company-wise" 

# Loop through each CSV file in the stock data directory
for filename in os.listdir(stock_data_directory):
    if filename.endswith('.csv'):
        file_path = os.path.join(stock_data_directory, filename)
        stock_df = pd.read_csv(file_path)
        stock_df['published_date'] = pd.to_datetime(stock_df['published_date'], errors='coerce')
        stock_df = stock_df.dropna(subset=['published_date'])

        # Merge stock data with sentiment scores
        merged_df = pd.merge(stock_df, combined_sentiment, on='published_date', how='left')

        # Check if 'sentiment_score' column exists
        if 'sentiment_score' in merged_df.columns:
            # Replace the 'sentiment_score' column with the updated values
            merged_df['sentiment_score'] = merged_df['sentiment_score'].fillna(0)  # Replace NaN with 0
        else:
            # Add the 'sentiment_score' column if it does not exist
            merged_df['sentiment_score'] = merged_df['sentiment_score'].fillna(0)

        # Overwrite the original file with the updated data
        merged_df.to_csv(file_path, index=False)

        print(f"Processed and updated: {filename}")

print("All files have been updated with sentiment scores.")
