const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios'); 
const app = express();
// Middleware to parse incoming JSON payloads from monday.com
app.use(bodyParser.json());

// --- 1. Date Calculation Function ---
/* * Calculates the date of the Nth day of the week (e.g., 3rd Thursday) 
 * in the current month.
 * @param {number} nth - The occurrence (e.g., 3 for 3rd).
 * @param {number} day - The day of the week (0=Sun, 1=Mon, 4=Thu, etc.).
 * @returns {string} The calculated date in YYYY-MM-DD format.
 */
function calculateNthDayInMonth(nth, day) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); 

    // Start at the 1st of the month
    let targetDate = new Date(year, month, 1);
    const firstDayOfWeek = targetDate.getDay(); 
    
    // Find the first occurrence of the target day
    let daysToAdd = (7 - firstDayOfWeek + day) % 7;
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    
    // Jump to the Nth occurrence (e.g., add (3-1) * 7 = 14 days)
    targetDate.setDate(targetDate.getDate() + (nth - 1) * 7);

    // Format the Date (YYYY-MM-DD) for monday.com API
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
}


// --- 2. The Custom Action Endpoint ---
// This handles the POST request from the monday.com automation.
app.post('/calculate-task', async (req, res) => {
    try {
        // Retrieve inputs sent by monday.com
        const { payload } = req.body;
        const { 
            boardId, 
            task_name, 
            nth_occurrence, 
            day_of_week 
        } = payload.inPublic.inputFields;

        // Calculate the required Due Date
        const calculatedDueDate = calculateNthDayInMonth(
            nth_occurrence, 
            day_of_week
        );

        // --- 3. Construct the API Call to Create the Item ---
        
        const dueDateColumnId = process.env.DUE_DATE_COLUMN_ID;
        const apiToken = process.env.MONDAY_API_TOKEN;
        
        // Column values must be a JSON string format
        const columnValues = JSON.stringify({
            [dueDateColumnId]: { date: calculatedDueDate } 
        });

        // Define the GraphQL mutation query
        const query = `mutation {
            create_item (
                board_id: ${boardId},
                group_id: "topics", // Assuming the default group ID is "topics"
                item_name: "${task_name}",
                column_values: "${columnValues}"
            ) {
                id
            }
        }`;

        // Send the request to monday.com API
        await axios.post('https://api.monday.com/v2', { query }, {
            headers: {
                'Authorization': apiToken, 
                'Content-Type': 'application/json',
            }
        });

        // Respond to monday.com to confirm success
        res.status(200).send({});

    } catch (error) {
        console.error("Error creating item:", error.message);
        // Send a 500 status to monday.com to signal failure
        res.status(500).send({ message: 'Error running action.' });
    }
});

// Start the server (Render will automatically set the PORT)
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
