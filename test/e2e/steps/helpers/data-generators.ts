/**
 * Data generation helpers for E2E mass response testing
 * Generates varied, realistic form data for comprehensive testing
 */

// Name pool for variety
const NAMES = [
    'Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown', 'Emma Davis',
    'Frank Miller', 'Grace Wilson', 'Henry Moore', 'Iris Taylor', 'Jack Anderson',
    'Kelly Thomas', 'Liam Jackson', 'Mia White', 'Noah Harris', 'Olivia Martin',
    'Peter Thompson', 'Quinn Garcia', 'Rachel Martinez', 'Sam Robinson', 'Taylor Clark',
    'Uma Rodriguez', 'Victor Lewis', 'Wendy Lee', 'Xavier Walker', 'Yara Hall',
    'Zoe Allen', 'Aaron Young', 'Betty King', 'Chris Wright', 'Diana Lopez',
    'Eric Hill', 'Fiona Scott', 'George Green', 'Hannah Adams', 'Ian Baker',
    'Julia Nelson', 'Kevin Carter', 'Laura Mitchell', 'Mark Perez', 'Nina Roberts'
];

// Color options matching form schema
const COLORS = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];

// Experience levels matching form schema
const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

// Interest options matching form schema
const INTERESTS = ['Technology', 'Sports', 'Music', 'Art', 'Travel', 'Food'];

// Satisfaction levels matching form schema
const SATISFACTION_LEVELS = [
    'Very Dissatisfied',
    'Dissatisfied',
    'Neutral',
    'Satisfied',
    'Very Satisfied'
];

// Comment templates for variety
const COMMENT_TEMPLATES = [
    'This is an excellent form! Very easy to use and intuitive.',
    'Great experience overall. The interface is clean and modern.',
    'I appreciate the simplicity and straightforward design.',
    'The form works well. No issues encountered during submission.',
    'Very satisfied with the user experience. Keep up the good work!',
    'The form is functional and serves its purpose effectively.',
    'Nice layout and easy navigation through the pages.',
    'Good job on the form design. It\'s user-friendly.',
    'The multi-page layout helps organize the information well.',
    'Smooth submission process. Everything worked as expected.',
    'The form is clear and easy to understand.',
    'I like how the form is structured with multiple pages.',
    'Great work! The form handles all field types very well.',
    'Excellent form functionality and design choices.',
    'The form validation works properly and provides good feedback.',
    'Very pleased with the overall form experience.',
    'The form is responsive and loads quickly.',
    'Good variety of field types available in the form.',
    'The form meets all my expectations for functionality.',
    'Well-designed form with a pleasant user interface.'
];

let nameIndex = 0;
let emailCounter = 0;

/**
 * Generate a unique name from the pool
 */
export function generateRandomName(): string {
    const name = NAMES[nameIndex % NAMES.length];
    nameIndex++;
    return name;
}

/**
 * Generate a unique email address
 */
export function generateRandomEmail(): string {
    emailCounter++;
    const timestamp = Date.now();
    return `test.user${emailCounter}.${timestamp}@example.com`;
}

/**
 * Generate a random date within a range
 * Returns dates between 1970 and 2005 (ages 20-55 approximately)
 */
export function generateRandomDate(): string {
    const startYear = 1970;
    const endYear = 2005;
    const year = startYear + Math.floor(Math.random() * (endYear - startYear + 1));
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1; // Use 28 to avoid month-length issues

    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');

    return `${year}-${monthStr}-${dayStr}`;
}

/**
 * Generate a random color from dropdown options
 */
export function generateRandomColor(): string {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

/**
 * Generate a random experience level
 */
export function generateRandomExperience(): string {
    return EXPERIENCE_LEVELS[Math.floor(Math.random() * EXPERIENCE_LEVELS.length)];
}

/**
 * Generate random years of experience (0-50)
 */
export function generateRandomYears(): number {
    return Math.floor(Math.random() * 51); // 0 to 50 inclusive
}

/**
 * Generate random interest selections (1-6 items)
 * Returns array of selected interests
 */
export function generateRandomInterests(): string[] {
    const count = Math.floor(Math.random() * INTERESTS.length) + 1; // 1 to 6
    const shuffled = [...INTERESTS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * Generate a random comment from templates
 */
export function generateRandomComment(): string {
    const templateIndex = Math.floor(Math.random() * COMMENT_TEMPLATES.length);
    return COMMENT_TEMPLATES[templateIndex];
}

/**
 * Generate a random satisfaction level
 */
export function generateRandomSatisfaction(): string {
    return SATISFACTION_LEVELS[Math.floor(Math.random() * SATISFACTION_LEVELS.length)];
}

/**
 * Generate a complete form response with all fields
 * Returns an object with field IDs as keys and generated values
 */
export function generateFormResponse() {
    return {
        'field-name': generateRandomName(),
        'field-email': generateRandomEmail(),
        'field-birth-date': generateRandomDate(),
        'field-favorite-color': generateRandomColor(),
        'field-experience-level': generateRandomExperience(),
        'field-years': generateRandomYears().toString(),
        'field-interests': generateRandomInterests(),
        'field-comments': generateRandomComment(),
        'field-satisfaction': generateRandomSatisfaction()
    };
}

/**
 * Reset counters (useful for testing)
 */
export function resetCounters() {
    nameIndex = 0;
    emailCounter = 0;
}
