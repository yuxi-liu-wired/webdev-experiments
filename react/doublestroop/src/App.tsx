import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Left from './Left';
import Right from './Right';

const App: React.FC = () => {
    const [difficulty, setDifficulty] = useState(4);
    const [gameData, setGameData] = useState({});

    useEffect(() => {
        // Generate the game data based on difficulty
        const data = generateGameData(difficulty);
        setGameData(data);
    }, [difficulty]);

    const handleDifficultyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (isNaN(value)) {
            setDifficulty(4);
        } else {
            setDifficulty(Math.min(10, Math.max(2, value)));
        }
    };

    return (
        <Router>
            <div>
                <h1>Double Stroop Puzzle</h1>
                <div>
                    Select Difficulty: (2 — 10)
                    <input type="number" value={difficulty} onChange={handleDifficultyChange} />
                </div>
                <Link to="/left" state={{ gameData }}>Match the hex codes on the left with the <i>colors</i> of the hex codes on the right</Link>
                <br />
                <Link to="/right" state={{ gameData }}>Match the <i>colors</i> of the hex codes on the left with the hex codes on the right</Link>

                <Routes>
                    <Route path="/left" element={<Left gameData={gameData} />} />
                    <Route path="/right" element={<Right gameData={gameData} />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;

// Function to generate game data
const generateGameData = (difficulty: number) => {
    const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
                    "#C0C0C0", "#808080", "#800000", "#808000", "#008000", "#800080",
                    "#008080", "#000080", "#000000", "#FFFFFF"];
    
    // Shuffle and sample colors
    const shuffleAndSample = (array: string[], size: number) => {
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, size);
    };

    const hexCodes = shuffleAndSample(colors, difficulty);
    const hexCodesLeft = shuffleAndSample(hexCodes, difficulty);
    const hexCodesRight = shuffleAndSample(hexCodes, difficulty);
    const hexColorsLeft = shuffleAndSample(hexCodes, difficulty);
    const hexColorsRight = shuffleAndSample(hexCodes, difficulty);

    return {
        hexCodes,
        hexCodesLeft,
        hexCodesRight,
        hexColorsLeft,
        hexColorsRight
    };
};
