## NutriCalc - MVP

### Main Problem

Manually entering ingredients into dietary apps is tedious and time-consuming. There is a need to paste a ready-made recipe from the internet that will calculate nutritional values — including fiber, iron, etc. Currently, many apps have incomplete ingredient databases — when information about e.g. fiber content is missing, it only shows "no data," which in final calculations is treated as 0 grams of fiber, which is misleading.

### Minimum Feature Set

- Creating a recipe from pasted text (copy-paste), then generating a list of ingredients and quantities via AI based on an API providing nutritional values, and finally displaying the total nutritional summary of the entire recipe (including fiber, iron, etc.)
- Manual editing of AI-generated ingredients or creating a recipe from scratch by hand
- Browsing, editing, and deleting recipes
- A simple user account system for storing recipes
- The app language (recipes, ingredients, etc.) is English

### What is NOT in scope for MVP

- Recipe serving scaling
- A custom ingredient database or custom ingredient-mapping algorithm
- Other languages
- Recipe sharing between users
- Mobile apps (web only initially)

### Success Criteria

- 75% of entered recipes are accepted by the user
- Users create 75% of recipes using AI
