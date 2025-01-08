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

# Check if 'Date' column exists and handle missing or malformed date values
if 'Date' in news_df.columns:
    news_df['Date'] = pd.to_datetime(news_df['Date'], errors='coerce')
    news_df = news_df.dropna(subset=['Date'])
else:
    raise ValueError("The 'Date' column is missing in the news data.")

# Function to compute sentiment score
def get_sentiment_score(text):
    return sia.polarity_scores(text)['compound']

# Apply function to compute sentiment scores
news_df['sentiment_score'] = news_df['Title'].apply(get_sentiment_score)

# Aggregate by date to get average sentiment score per day
daily_sentiment = news_df.groupby(news_df['Date'].dt.date)['sentiment_score'].mean().reset_index()
daily_sentiment['Date'] = pd.to_datetime(daily_sentiment['Date'])

# Function to calculate Sunday sentiment
def calculate_sunday_sentiment(daily_sentiment):
    sunday_sentiments = []
    for date in daily_sentiment['Date']:
        if date.weekday() == 6:  # Sunday
            # Calculate dates for Friday, Saturday, and Sunday
            friday = date - timedelta(days=2)
            saturday = date - timedelta(days=1)
            sunday = date
            # Filter news from Friday, Saturday, and Sunday
            mask = daily_sentiment['Date'].isin([friday, saturday, sunday])
            avg_sentiment = daily_sentiment[mask]['sentiment_score'].mean()
            sunday_sentiments.append({'Date': sunday, 'sentiment_score': avg_sentiment})
    return pd.DataFrame(sunday_sentiments)

# Calculate Sunday sentiments
sunday_sentiment_df = calculate_sunday_sentiment(daily_sentiment)

# Combine daily sentiment with Sunday sentiment
combined_sentiment = pd.concat([daily_sentiment, sunday_sentiment_df]).drop_duplicates(subset='Date').reset_index(drop=True)

# Directory containing stock data files
stock_data_directory = "./data/company-wise"

# Loop through each CSV file in the stock data directory
for filename in os.listdir(stock_data_directory):
    if filename.endswith('.csv'):
        file_path = os.path.join(stock_data_directory, filename)
        stock_df = pd.read_csv(file_path)
        
        # Check if 'published_date' column exists in stock_df
        if 'published_date' in stock_df.columns:
            stock_df['published_date'] = pd.to_datetime(stock_df['published_date'])
        else:
            print(f"'published_date' column is missing in {filename}. Skipping this file.")
            continue
        
        # Ensure 'Date' column is present in stock_df
        if 'Date' not in stock_df.columns:
            stock_df['Date'] = stock_df['published_date'].dt.date
        
        # Ensure 'Date' columns are of the same data type
        stock_df['Date'] = pd.to_datetime(stock_df['Date'])
        combined_sentiment['Date'] = pd.to_datetime(combined_sentiment['Date'])
        
        # Debug: Print first few rows of each DataFrame
        print(f"Processing file: {filename}")
        print("Stock DataFrame Preview:")
        print(stock_df[['Date']].head())
        print("Sentiment DataFrame Preview:")
        print(combined_sentiment.head())

        # Perform the merge
        merged_df = pd.merge(stock_df, combined_sentiment, on='Date', how='left')

        # Debug: Print merged DataFrame structure
        print("Merged DataFrame Preview:")
        print(merged_df.head())
        print("Columns in merged_df:", merged_df.columns)

        # Check if 'sentiment_score' exists before trying to access it
        if 'sentiment_score' in merged_df.columns:
            # Fill missing sentiment scores with 0 (neutral sentiment)
            merged_df['sentiment_score'].fillna(0, inplace=True)

            # Ensure 'sentiment_score' column is the rightmost
            columns = [col for col in merged_df.columns if col != 'sentiment_score'] + ['sentiment_score']
            merged_df = merged_df[columns]

            # Overwrite the original file with the updated data
            merged_df.to_csv(file_path, index=False)
            print(f"Processed and updated: {filename}")
        else:
            print(f"'sentiment_score' column is missing in the merged DataFrame for {filename}. Skipping this file.")

print("All files have been updated with sentiment scores.")
