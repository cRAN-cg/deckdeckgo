import {Component, Prop, Element, Method, Watch, h} from '@stencil/core';

import {BaseType, Selection} from 'd3-selection';
import {pie, arc, Pie, Arc, DefaultArcObject} from 'd3-shape';

import {DeckdeckgoChart, DeckdeckgoChartUtils} from '../deckdeckgo-chart';
import {transition} from 'd3-transition';
import {ascending} from 'd3-array';

interface DeckdeckgoPieChartDataValue {
  label: string;
  value: number;
  randomFillColor: string;
  key: number;
}

interface DeckdeckgoPieChartData {
  values: DeckdeckgoPieChartDataValue[];
}

@Component({
  tag: 'deckgo-pie-chart',
  styleUrl: 'deckdeckgo-pie-chart.scss',
  shadow: true
})
export class DeckdeckgoPieChart implements DeckdeckgoChart {

  @Element() el: HTMLElement;

  @Prop({mutable: true}) width: number;
  @Prop({mutable: true}) height: number;

  // Specify a number for a donut chart
  @Prop() innerRadius: number = 0;

  @Prop() src: string;
  @Prop() separator: string = ';';

  @Prop() animation: boolean = false;
  @Prop() animationDuration: number = 1000;

  private svg: Selection<BaseType, any, HTMLElement, any>;
  private myPath: Arc<any, DefaultArcObject>;

  private data: DeckdeckgoPieChartData[];

  private pieDataIndex: number = 0;

  async componentDidLoad() {
    await this.draw();
  }

  @Watch('src')
  async redraw() {
    await this.draw();
  }

  @Method()
  draw(width?: number, height?: number): Promise<void> {
    return new Promise<void>(async (resolve) => {
      if (width > 0) {
        this.width = width;
      }

      if (height > 0) {
        this.height = height;
      }

      if (!this.width || !this.height || !this.src) {
        resolve();
        return;
      }

      this.pieDataIndex = 0;

      this.svg = DeckdeckgoChartUtils.initSvg(this.el, this.width, this.height);
      this.svg = this.svg.append('g').attr('transform', 'translate(' + (this.width / 2) + ',' + (this.height / 2) + ')');

      const radius: number = Math.min(this.width, this.height) / 2;

      this.myPath = arc().innerRadius(this.innerRadius).outerRadius(radius);

      this.data = await this.fetchData();

      if (!this.data || this.data.length <= 0) {
        resolve();
        return;
      }

      await this.drawPie(0, 0);

      resolve();
    });
  }

  @Method()
  async next() {
    await this.prevNext(true);
  }

  @Method()
  async prev() {
    await this.prevNext(false);
  }

  private async prevNext(next: boolean) {
    if (!this.animation) {
      return;
    }

    if (!this.data || this.data.length <= 0) {
      return;
    }

    if (next && this.pieDataIndex + 1 < this.data.length) {
      this.pieDataIndex++;
      await this.drawPie(this.pieDataIndex, this.animationDuration);
    } else if (!next && this.pieDataIndex > 0) {
      this.pieDataIndex--;
      await this.drawPie(this.pieDataIndex, this.animationDuration);
    }
  }

  @Method()
  isBeginning(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this.animation) {
        resolve(true);
        return;
      }

      resolve(this.pieDataIndex === 0);
    });
  }

  @Method()
  isEnd(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this.animation) {
        resolve(true);
        return;
      }

      resolve(this.pieDataIndex === this.data.length - 1);
    });
  }

  private async drawPie(index: number, animationDuration: number) {
    const pie: any[] = await this.createPieData(this.data[index]);

    await this.drawPieForData(pie, animationDuration);

    setTimeout(async () => {
      await this.appendLabel(pie);
    }, animationDuration);
  }

  private drawPieForData(myPieData: any[], animationDuration: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const t = transition();

      const section: any = this.svg.selectAll('path').data(myPieData);

      section
        .enter()
        .append('path')
        .merge(section)
        .attr('style', (d) => {
          return 'fill: var(--deckgo-chart-fill-color-' + d.data.key + ', ' + (d.data.randomFillColor ? `#${d.data.randomFillColor}` : '') + '); fill-opacity: var(--deckgo-chart-fill-opacity-' + d.data.key + '); stroke: var(--deckgo-chart-stroke-' + d.data.key + '); stroke-width: var(--deckgo-chart-stroke-width-' + d.data.key + ')';
        })
        .transition(t).duration(animationDuration)
        .attr('d', this.myPath);

      section
        .exit()
        .remove();

      resolve();
    });
  }

  private async createPieData(data: any): Promise<any[]> {
    return new Promise<any[]>(async (resolve) => {
      // Generate a pie chart
      const myPie: Pie<any, number | { valueOf(): number }> = pie().value((d: any) => {
        return d.value
      }).sort((a: any, b: any) => { return ascending(a.label, b.label);} );

      const result: any[] = myPie(data.values);

      resolve(result);
    });
  }

  private appendLabel(myPieData: any[]): Promise<void> {
    return new Promise<void>((resolve) => {

      this.svg.selectAll('.text-arc').remove();

      // Create a special arcs for the labels in order to always display them above the pie's slices
      const labelArcs: Selection<SVGElement, any, BaseType, any> = this.svg.selectAll('.text-arc')
        .data(myPieData)
        .enter()
        .append('g')
        .attr('class', 'text-arc');

      const text = labelArcs.append('text')
        .attr('transform', (d: DefaultArcObject) => {
          return 'translate(' + this.myPath.centroid(d) + ')';
        })
        .attr('dy', '.35em')
        .style('text-anchor', 'middle');

      text.append('tspan')
        .attr('x', 0)
        .attr('y', '-0.7em')
        .style('font-weight', 'bold')
        .text((d: any) => {
          return d.data.label ? d.data.label : '';
        });

      text.filter((d: any) => (d.endAngle - d.startAngle) > 0.25).append('tspan')
        .attr('x', 0)
        .attr('y', '0.7em')
        .text((d: any) => {
          return d.data.value + '%';
        });

      resolve();
    });
  }

  async fetchData(): Promise<DeckdeckgoPieChartData[]> {
    return new Promise<DeckdeckgoPieChartData[]>(async (resolve) => {
      if (!this.src) {
        resolve([]);
        return;
      }

      const response: Response = await fetch(this.src);
      const content: string = await response.text();

      if (!content) {
        resolve([]);
        return;
      }

      const lines: string[] = content.split('\n');

      if (!lines || lines.length <= 0) {
        resolve([]);
        return;
      }

      let results: DeckdeckgoPieChartData[] = [];
      let randomColors: string[];

      lines.forEach((line: string, lineIndex: number) => {
        const values: string[] = line.split(this.separator);

        if (values && values.length >= 2) {
          if (!randomColors) {
            randomColors = Array.from({ length: lines.length }, (_v, _i) => (Math.floor(Math.random()*16777215).toString(16)));
          }

          const label: string = values[0];

          const pieData: DeckdeckgoPieChartDataValue = {
            label: label,
            value: parseInt(values[1]),
            randomFillColor: randomColors.length >= 1 ? randomColors[lineIndex] : undefined,
            key: lineIndex + 1
          };

          if (!isNaN(pieData.value)) {
            if (results.length <= 0) {
              results.push({
                values: []
              });
            }

            results[0].values.push(pieData);
          }

          if (values.length > 2) {
            for (let i = 2; i < values.length; i++) {
              const tmp: number = parseInt(values[i]);
              if (!isNaN(tmp)) {
                if (results.length < i) {
                  results.push({
                    values: []
                  });
                }

                const pieData: DeckdeckgoPieChartDataValue = {
                  label: label,
                  value: parseInt(values[i]),
                  randomFillColor: randomColors.length >= i ? randomColors[lineIndex] : undefined,
                  key: lineIndex + 1
                };

                results[i - 1].values.push(pieData);
              }
            }
          }
        }
      });

      resolve(results);
    });
  }

  render() {
    return <svg></svg>;
  }
}
