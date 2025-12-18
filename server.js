const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios'); 
const app = express();

app.use(bodyParser.json());

// THE MATH BRAIN
function getTheDate(nth, day) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); 

    let d = new Date(year, month, 1);
    // Find first occurrence of that day
    while (d.getDay() !== parseInt(day)) {
        d.setDate(d.getDate() + 1);
    }
    // Add weeks to get to the "Nth" one
    d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);

    return d.toISOString().split('T')[0]; // Returns YYYY-MM-DD
}

// THE HANDSHAKE WITH MONDAY
app.post('/calculate-task', async (req, res) => {
    try {
        const { payload } = req.body;
        const { boardId, task_name, nth_occurrence, day_of_week } = payload.inPublic.inputFields;

        const calculatedDate = getTheDate(nth_occurrence, day_of_week);

        // CREATE THE ITEM
        const query = `mutation {
            create_item (
                board_id: ${boardId},
                item_name: "${task_name}",
                column_values: "{\\"${process.env.DUE_DATE_COLUMN_ID}\\": {\\"date\\": \\"${calculatedDate}\\"}}"
            ) { id }
        }`;

        await axios.post('https://api.monday.com/v2', { query }, {
            headers: {
                'Authorization': process.env.MONDAY_API_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        res.status(200).send({});
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to create task" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Brain is running on port ${PORT}`));
