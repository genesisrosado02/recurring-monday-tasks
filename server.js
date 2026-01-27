const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

app.post('/calculate-task-on-nth-day', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inputFields || {};

        // 1. Get IDs passed from the UI
        const boardId = fields.boardId;
        const itemId = fields.itemId; // This comes from 'Trigger Output'
        
        // 2. Logic Inputs
        const dayToFind = parseInt(fields.day_of_week?.value || fields.day_of_week);
        const occurrence = parseInt(fields.nth_occurence?.value || fields.nth_occurence);
        
        // 3. Column IDs
        const dateColumn = fields.dateColumnId;
        const statusColumn = fields.statusColumnId;

        if (!itemId || !boardId) {
            console.error("Missing IDs: Item and Board are required.");
            return res.status(200).send({}); 
        }

        // 4. Calculation Logic
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Find first occurrence
        while (d.getDay() !== dayToFind) {
            d.setDate(d.getDate() + 1);
        }
        // Add weeks for Nth occurrence
        d.setDate(d.getDate() + (occurrence - 1) * 7);
        
        const calculatedDate = d.toISOString().split('T')[0];
        const currentMonthName = monthNames[now.getMonth()];

        // 5. Prepare Payload for API 2025-04
        // Note: Using the 'label' key ensures the Status column matches by name
        const columnValues = {
            [dateColumn]: { "date": calculatedDate },
            [statusColumn]: { "label": currentMonthName }
        };

        // 6. Strict GraphQL Variable Format (Required for 2025-04)
        const query = `mutation ($board: ID!, $item: ID!, $values: JSON!) { 
            change_multiple_column_values (
                board_id: $board, 
                item_id: $item, 
                column_values: $values,
                create_labels_if_missing: true
            ) { id } 
        }`;

        const variables = {
            board: boardId,
            item: itemId,
            values: JSON.stringify(columnValues)
        };

        const response = await axios.post('https://api.monday.com/v2', 
            { query, variables }, 
            { headers: { 
                'Authorization': process.env.MONDAY_API_TOKEN, 
                'API-Version': '2025-04' 
            }}
        );

        if (response.data.errors) {
            console.error("GraphQL Errors:", JSON.stringify(response.data.errors));
        }

        res.status(200).send({});
    } catch (err) {
        console.error("Critical Error:", err.response?.data || err.message);
        res.status(200).send({}); 
    }
});

app.listen(process.env.PORT || 3000);
