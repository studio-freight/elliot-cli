import {Command, flags} from '@oclif/command'
import { elliotDisplay } from '../lib/helpers';
import { setElliotCredentials } from '../lib/auth';
import { getDomains, getCheckout, getApiKey } from '../api/query';
import { selectDomain, selectCheckout } from '../lib/inquirer';
import Configstore from 'configstore';
import chalk from 'chalk';
import execa from 'execa';
import Listr from 'listr';
import path from 'path';

const conf = new Configstore('elliot-cli');

export default class Deploy extends Command {
  static description = 'Deploy storefront to ZEIT'

  async run() {
    elliotDisplay()

    const login       = await setElliotCredentials()
    const insDir      = `${path.join(__dirname, '../../scripts/install.sh')}`
    const setUpEnvDir = `${path.join(__dirname, '../../scripts/setupEnv.sh')}`

    try {
      if (login) {
        const fetchDomains   = await getDomains()
        const domains         = await selectDomain(fetchDomains)
        const selectedDomain = fetchDomains.filter(domain => domain.name === domains.domain);

        const domainId = selectedDomain[0].id
        const checkout = await getCheckout(domainId)

        try {
          if (checkout === undefined || checkout.length === 0) {
            return console.log(chalk.yellow("You have no storefront for this domain"))
          } else {
  
            const checkoutDetails  = await selectCheckout(checkout)
            const selectedCheckout = checkout.filter(checkout => checkout.name === checkoutDetails.storefront);
            const checkoutId       = selectedCheckout[0].id
            const checkoutName     = selectedCheckout[0].name
  
            const fetchApiKeys     =  await getApiKey(domainId)
            const apikeys          =  fetchApiKeys[0].node.key
  
            const tasks = new Listr([
              {
                title: 'Cloning zeit-boilerplate-directory',
                task: () => execa('git', ['clone', 'https://github.com/helloiamelliot/zeit-checkout-boilerplate']).catch(result =>{
                  if (result.stderr == "fatal: destination path 'zeit-checkout-boilerplate' already exists and is not an empty directory.") {
                    throw new Error('zeit-checkout-boilerplate directory already exists and is not an empty directory.')
                  }
                })
              },
              {
                title: 'Install package dependencies with Yarn',
                task: (ctx, task) => execa(insDir)
                  .catch(() => {
                    ctx.yarn = false;
            
                    task.title = `${task.title} (or not)`;
                    task.skip('Yarn not available');
                  })
              },
              {
                title: 'Install package dependencies with npm',
                skip: ctx => ctx.yarn !== false && 'Dependencies already installed with Yarn',
                task: (ctx, task) => {
                  task.output = 'Installing dependencies...';
                  return execa(insDir, ['npm'])
                }
              },
              {
                title: 'Setting up environment variables',
                task: () => execa(setUpEnvDir, [`${checkoutId}`,`${checkoutName}`,`${domainId}`,`${apikeys}`]).catch(error => {
                  console.log(error)
                })
              },
            ]);
            
            tasks.run().catch(err => {
                console.error(err);
            });
          }
          
        } catch (error) {
          console.error(error)
        }        
      }
    } catch(e) {
      throw new Error(e)
    }    
  }
}


 
