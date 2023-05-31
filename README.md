# Obsidian Repeat Plugin: Enhance Your Note Review Experience

The Obsidian Repeat Plugin offers a comprehensive solution for efficiently reviewing notes using periodic and spaced repetition.
By integrating directly into your Obsidian workspace, this plugin provides a streamlined and effective way to revisit and retain information from your notes over time:

1. **Periodic Repetition**:
   - Seamlessly review your notes on a recurring basis.
   - Customize the frequency of reviews to suit your preferences.
   - Choose from a range of options: daily, weekly, monthly, yearly, or set a specific interval of K days/weeks/months/years.
   - By default, periodic reviews are scheduled early in the morning, ensuring all notes due on a given date are conveniently reviewed together.

2. **Spaced Repetition**:
   - Optimize your learning with a dynamic review schedule.
   - Modify the frequency of spaced repetition for each note during reviews.
   - For instance, if the current review frequency is set at every 10 days, you can effortlessly adjust the next review to occur in 5 days (0.5x), 10 days (1x), 15 days (1.5x), or 20 days (2x).

Our plugin provides a seamless and versatile note reviewing experience, allowing you to maximize retention and effectively manage your knowledge.

## Why Use the Repeat Plugin?

* **Gain Insights Over Time**: Consider the value of gaining insights into your thoughts and ideas from previous years. With the Repeat Plugin, you can review your journal entries or any other notes on a yearly basis, giving you a unique perspective on your personal growth and evolving perspectives.

* **Stay on Top of Recurring Tasks and Goals**: The plugin also serves as a handy reminder system for recurring tasks. Whether it's reviewing journal articles every Wednesday or going through your task list at specific intervals, the Repeat Plugin can surface these reminders to help you stay on track and make progress.

* **Get the Most from Your Reading**: Are you an avid reader? By creating a book note when you start a new read and using spaced repetition, you can reinforce your understanding of the book's content by occasionally adding your thoughts and reflections. This way, you'll have a comprehensive summary of your reading experience and a deeper understanding of the material.

- **Long-Term Knowledge Retention**: If you're studying complex concepts or want to ensure long-term retention of important information, the Repeat Plugin can assist you. Summarize the key points of a concept you wish to remember and use spaced repetition to reinforce it over time. You can even keep the body of the note you're reviewing hidden until you're ready to check your answer. This technique will help you solidify your understanding and recall the information when you need it most.

## Installation and Integration

Getting started with the Repeat Plugin is a breeze and consists of going to Obsidian's community plugins list (via Settings > Options > Community plugins > Browse) and installing

1. The Dataview Plugin
2. The Repeat Plugin

Once installed, the Repeat Plugin adds a **Repeat view** to your Obsidian workspace.
Simply click the "clock" icon in Obsidian's ribbon menu or run the **Review due notes** command to access the Repeat view.

You may also notice a due note counter added to Obsidian's status bar.
Initially, you won't have any notes due, so read on to find out how to mark notes for repetition.
Once a note becomes due for review, the due note counter in the status bar will update and you will be able to review the note in the newly added Repeat view.

## Tailoring Your Note Reviews

The Repeat Plugin offers flexible options for choosing which notes to review and customizing their repetition patterns.
This section describes how you can make the most of it.

### 1. Easily Mark a Note for Repetition

While editing a note, you can use convenient commands to mark it for repetition:

- **Repeat this note...**: Opens a modal where you can customize the note's repetition settings.
- **Repeat this note every day/week/month/year**: Quickly set the note to repeat at regular intervals.

![The "Repeat this note..." modal](./images/modal.png)

Repetition information is stored in the `repeat`, `due_at`, and `hidden` frontmatter fields of the note.
You can also manually create or edit these fields to customize the repetition settings.

### 2. Customizing Repetition Patterns

The `repeat` field allows you to define the repetition pattern for your notes. Here are some formatting options:

- **Periodic Repetition**: Use values like `daily`, `weekly`, `monthly`, `yearly`, or specify a specific interval like `every K days/weeks/months/years`.
- **Spaced Repetition**: Use the format `spaced every K hours/days/weeks/months/years` to pick the initial review period. Future review periods will be dynamically set at review time by the plugin.

For example, if you want to review a note every three days, set the `repeat` field to `every 3 days`.
The plugin will automatically calculate the next review date based on this pattern and populate the `due_at` field when you first review the note.

### 3. Morning or Evening Repetition

By default, periodic notes and spaced notes with intervals of at least a week become due at 6 AM. If you prefer an evening review, you can add `in the evening` to the note's repeat field.
For example, changing `repeat: every 2 weeks` to `repeat: every 2 weeks in the evening` will make the note due at 6 **PM** every two weeks.

You can also adjust the repetition time using the convenient options available in the "Repeat this note..." modal. If you choose a note for evening repetition, your choice will of course be preserved between reviews.

### 4. One-Sided Flashcards

When you enable the "Hidden" option while adjusting the repetition fields of a note in the "Repeat this note..." modal (manually represented as `hidden: true`), the content of your note will appear blurred in the Repeat view. By clicking on the blurred content, you can reveal the hidden information, allowing you to effectively test your knowledge and strengthen your understanding using one-sided flashcards.

### 5. Extra Features

You have the option to exclude a specific folder from note reviews, which proves especially beneficial if your vault includes templates.
Accessing the settings for the Repeat Plugin is easy: simply go to Settings > Community plugins > Repeat.

By leveraging the power of Dataview queries, you can delve deeper into the notes you review in your vault.
The information regarding how a note is reviewed is stored in a few key fields within the note's frontmatter, so you can write queries against them.
To explore the capabilities of Dataview queries and gain further insights, refer to [Dataview's documentation](https://blacksmithgu.github.io/obsidian-dataview/).

## Additional Resources and Development

The Repeat Plugin offers a wide range of possibilities to optimize your note review process.
If you're interested in further exploring the plugin's features or contributing to its development, here are some resources to check out:

- **More Tools**: The `add_repeat_to_notes.py` script from [https://github.com/prncc/obsidian-scripts](https://github.com/prncc/obsidian-scripts) allows you to interactively add the `repeat` field to notes in your existing vault. The Repeat Plugin will be able to pick up those notes from there.
- **Development**: Pull requests are welcome for the Repeat Plugin. If you have a significant change in mind, create an issue to discuss it with the community first. You may also find some issues with the "help wanted" tag in the Issues tab of [the plugin's GitHub repo](https://github.com/prncc/obsidian-repeat-plugin).
- **Similar Software**: [msipos/mind-palace: Mind palace: mnemonic note taking system.](https://github.com/msipos/mind-palace)

The Obsidian Repeat Plugin empowers you to make the most of your notes and ensure long-term retention of valuable information.
With its seamless integration and customizable features, this plugin is a valuable addition to any knowledge worker's toolkit.
