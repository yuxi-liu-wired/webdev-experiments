<template>
  <div class="game-container">
    <h1>Double Stroop Puzzle</h1>
    <div class="columns">
      <div class="left-column">
        <p v-for="(hexCode, index) in hexCodesLeft" :key="index" :style="{ color: hexColorsLeft[index] }">
          {{ hexCode }}
        </p>
      </div>
      
      <div class="right-column">
        <draggable v-model="hexColorsRight" tag="ul" @end="onEndDrag">
          <template #item="{element, index}">
            <li :style="{ color: element }">{{ hexCodesRight[index] }}</li>
          </template>
        </draggable>
      </div>
    </div>
    <button @click="checkAnswers">Check Answers</button>
    <p>{{ message }}</p>
  </div>
</template>

<script>
import draggable from 'vuedraggable';
import tinycolor from 'tinycolor2';

export default {
  name: 'DoubleStroopPuzzle',
  components: {
    draggable,
  },
  data() {
    return {
      hexCodesLeft: ['#FF0000'],
      hexColorsLeft: ['#FF0000'],
      hexCodesRight: ['#FF0000'],
      hexColorsRight: ['#FF0000'],
      message: '',
      startTime: null,
    };
  },

methods: {
  shuffleArray(unshuffled) {
    return unshuffled
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
  },
  onEndDrag() {
    // This method will be called when the drag operation ends.
    // You can add any additional logic you need here.
    // For example, re-check answers or update the state
  },

  initializeGame() {
    const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
                    "#C0C0C0", "#808080", "#800000", "#808000", "#008000", "#800080",
                    "#008080", "#000080", "#000000", "#FFFFFF"];
    const difficulty = 4;

    const shuffledColors = this.shuffleArray(colors);
    const hexCodes = shuffledColors.slice(0, difficulty);

    this.hexCodesLeft = this.shuffleArray(hexCodes);
    this.hexColorsLeft = this.shuffleArray(hexCodes);
    this.hexCodesRight = this.shuffleArray(hexCodes);
    this.hexColorsRight = this.shuffleArray(hexCodes);
    },

    checkAnswers() {
      // Convert colors to hex for comparison
      const convertedColors = this.hexColorsLeft.map(color => 
        tinycolor(color).toHexString().toUpperCase()
      );

      if (JSON.stringify(convertedColors) === JSON.stringify(this.hexCodesRight)) {
        const endTime = new Date().getTime();
        const timeTaken = ((endTime - this.startTime) / 1000).toFixed(2);
        this.message = `Congratulations! You have solved the puzzle correctly. Time taken: ${timeTaken} seconds.`;
      } else {
        this.message = "Sorry, some of your answers are incorrect. Try again!";
      }
    }
  },
  mounted() {
    this.initializeGame();
    this.startTime = new Date().getTime();
  }
};
</script>

<style scoped>
/* CSS styles go here */
.columns {
  display: flex;
}
.left-column, .right-column {
  width: 50%;
}
.sortable {
  list-style-type: none;
  padding: 0;
}
.sortable li {
  cursor: move;
  /* Other styles */
}
</style>
